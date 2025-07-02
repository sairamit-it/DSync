// Service Worker for push notifications
const CACHE_NAME = 'dsync-v1';

self.addEventListener('install', (event) => {
  console.log('Service Worker installing');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();
  
  const { chatId, messageId } = event.notification.data || {};
  
  if (event.action === 'reply') {
    // Open chat window focused on reply
    event.waitUntil(
      self.clients.openWindow(`/chat?chatId=${chatId}&action=reply`)
    );
  } else if (event.action === 'mark-read') {
    // Mark message as read via API
    event.waitUntil(
      fetch(`/api/message/${messageId}/read`, {
        method: 'PUT',
        credentials: 'include'
      })
    );
  } else {
    // Default action - open chat
    event.waitUntil(
      self.clients.openWindow(`/chat?chatId=${chatId}`)
    );
  }
});

self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);
});