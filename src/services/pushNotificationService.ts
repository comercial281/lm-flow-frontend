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
