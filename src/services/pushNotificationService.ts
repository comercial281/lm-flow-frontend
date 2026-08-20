import apiClient from '@/services/core/api';

// VAPID public key vem do backend
let cachedVapidKey: string | null = null;

async function getVapidPublicKey(): Promise<string> {
  if (cachedVapidKey) return cachedVapidKey;
  // Backend responde no envelope padrão { success, data: { vapid_public_key }, meta }.
  // axios já coloca o corpo em res.data, então a chave fica em res.data.data.vapid_public_key.
  // Ler res.data.vapid_public_key (sem o .data extra) devolvia undefined → o
  // applicationServerKey ficava inválido → pushManager.subscribe() lançava →
  // toast "Erro ao alterar modo plantão". Suporta os dois formatos por segurança.
  const res = await apiClient.get<{ data?: { vapid_public_key?: string }; vapid_public_key?: string }>(
    '/push_subscriptions/vapid_public_key'
  );
  const key = res.data?.data?.vapid_public_key ?? res.data?.vapid_public_key;
  if (!key) throw new Error('VAPID public key ausente na resposta do backend');
  cachedVapidKey = key;
  return cachedVapidKey;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/**
 * Dispara um push de teste NESTE usuário (só nos aparelhos dele).
 *
 * Existe porque push que não chega é silencioso: quem liga o Modo Plantão não
 * tinha como saber se funcionou — até 16/07/2026 o único jeito de testar era
 * `rails runner` em produção.
 *
 * Devolve a quantidade de aparelhos que receberam. O backend responde 422
 * (NO_SUBSCRIPTION) quando ninguém tem plantão ligado, em vez de fingir sucesso.
 */
export async function sendTestPush(): Promise<number> {
  const res = await apiClient.post<{ data?: { devices?: number } }>('/push_subscriptions/test');
  return res.data?.data?.devices ?? 0;
}

export async function subscribeToPush(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const registration = await navigator.serviceWorker.ready;
  const vapidKey = await getVapidPublicKey();

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });

  try {
    await apiClient.post('/push_subscriptions', {
      push_subscription: subscription.toJSON(),
    });
  } catch (err) {
    // Cancela a subscription no browser se o backend rejeitou — evita estado inconsistente.
    await subscription.unsubscribe().catch(() => {});
    console.error('[Push] falha ao registrar no backend:', err);
    return false;
  }

  return true;
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  await apiClient.delete('/push_subscriptions', {
    data: { endpoint: subscription.endpoint },
  });
  await subscription.unsubscribe();
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  const registration = await navigator.serviceWorker.ready;
  const sub = await registration.pushManager.getSubscription();
  return !!sub;
}

/**
 * Reenvia ao backend a inscrição que o navegador já tem.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * O BUG QUE ISTO CONSERTA (2026-07-31)
 * ─────────────────────────────────────────────────────────────────────────
 * O toggle do Modo Plantão decide "ligado" só olhando o navegador
 * (isPushSubscribed acima) — nunca pergunta ao servidor. E o servidor APAGA a
 * inscrição sozinho quando o serviço de push responde 410/inválido: ver
 * PushCentral::Sender#blast e Notification::PushNotificationService, os dois
 * fazem `destroy` no rescue. Isso está certo em si (endereço morto tem de sair),
 * mas endereços morrem por motivo banal: navegador atualizou, aparelho ficou
 * tempo demais sem abrir o app, sistema rotacionou a chave.
 *
 * Sem re-registro, o resultado era permanente e invisível: o servidor apagava, o
 * navegador mantinha a cópia local, o toggle continuava verde e a pessoa nunca
 * mais recebia push — sem erro em lugar nenhum. Era a queixa "está com as
 * notificações ativas e não chega".
 *
 * É seguro chamar sempre: o backend faz find_or_initialize_by(endpoint), então
 * reenviar é idempotente. E não ressuscita quem desligou o plantão de propósito:
 * unsubscribeFromPush também chama subscription.unsubscribe(), então o navegador
 * fica sem inscrição e aqui não há nada a enviar.
 */
export async function syncPushSubscription(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return false;

    await apiClient.post('/push_subscriptions', {
      push_subscription: subscription.toJSON(),
    });
    return true;
  } catch (err) {
    // Não crítico: tenta de novo no próximo carregamento do app.
    console.warn('[Push] não consegui ressincronizar a inscrição:', err);
    return false;
  }
}
