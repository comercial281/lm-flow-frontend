// Handlers de push notification e notificationclick
// Importado pelo service worker gerado pelo vite-plugin-pwa via importScripts

self.addEventListener('push', function(event) {
  if (!event.data) return;

  var payload;
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { title: 'LM Flow', body: event.data.text() };
  }

  var options = {
    body: payload.body,
    icon: payload.icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    // Agrupar TUDO sob a mesma tag fazia o segundo aviso substituir o primeiro:
    // dois leads chegando juntos viravam uma notificação só. Agrupa por destino,
    // então mensagens da mesma conversa ainda se sobrepõem (desejável) mas leads
    // diferentes aparecem separados.
    tag: payload.tag || payload.url || 'lmflow-message',
    renotify: true,
    data: { url: payload.url || '/conversations' },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

// O navegador pode ROTACIONAR a inscrição de push por conta própria (chave
// expirada, atualização do próprio navegador). Quando isso acontece o endpoint
// antigo morre e o servidor, ao levar 410 na próxima entrega, apaga a linha —
// e o app continuava mostrando "Modo Plantão ligado" para sempre, sem receber
// nada.
//
// Aqui só re-inscrevemos com a mesma applicationServerKey. O POST para o backend
// NÃO acontece aqui de propósito: o service worker não tem o token de
// autenticação, e criar um endpoint sem autenticação só para isto seria pior.
// Quem envia é o syncPushSubscription() do app, no próximo carregamento — os
// dois juntos fecham o ciclo.
self.addEventListener('pushsubscriptionchange', function(event) {
  var oldKey = event.oldSubscription && event.oldSubscription.options
    ? event.oldSubscription.options.applicationServerKey
    : null;
  if (!oldKey) return;

  event.waitUntil(
    self.registration.pushManager
      .subscribe({ userVisibleOnly: true, applicationServerKey: oldKey })
      .catch(function(err) {
        console.warn('[Push SW] falha ao re-inscrever após rotação:', err);
      })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || '/conversations';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clients) {
        for (var i = 0; i < clients.length; i++) {
          var client = clients[i];
          if (client.url.indexOf(self.location.origin) !== -1 && 'focus' in client) {
            client.focus();
            client.navigate(url);
            return;
          }
        }
        return self.clients.openWindow(url);
      })
  );
});
