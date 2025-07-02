// Push notification utilities
export class NotificationManager {
  constructor() {
    this.permission = Notification.permission;
    this.isSupported = 'Notification' in window;
    this.isServiceWorkerSupported = 'serviceWorker' in navigator;
  }

  async requestPermission() {
    if (!this.isSupported) {
      console.warn('Notifications not supported');
      return false;
    }

    if (this.permission === 'granted') {
      return true;
    }

    if (this.permission === 'denied') {
      return false;
    }

    const permission = await Notification.requestPermission();
    this.permission = permission;
    return permission === 'granted';
  }

  async showNotification(title, options = {}) {
    if (!this.isSupported || this.permission !== 'granted') {
      return null;
    }

    // Don't show notification if page is visible
    if (!document.hidden) {
      return null;
    }

    const defaultOptions = {
      icon: '/src/public/DSync.jpg',
      badge: '/src/public/DSync.jpg',
      tag: 'dsync-message',
      requireInteraction: false,
      silent: false,
      ...options
    };

    try {
      if (this.isServiceWorkerSupported && 'serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        return registration.showNotification(title, defaultOptions);
      } else {
        return new Notification(title, defaultOptions);
      }
    } catch (error) {
      console.error('Failed to show notification:', error);
      return null;
    }
  }

  showMessageNotification(message, chatName) {
    const title = chatName || message.sender.name;
    let body = '';

    switch (message.messageType) {
      case 'image':
        body = '📷 Sent a photo';
        break;
      case 'file':
        body = '📎 Sent a file';
        break;
      default:
        body = message.content;
        break;
    }

    return this.showNotification(title, {
      body,
      data: {
        chatId: message.chat._id || message.chat,
        messageId: message._id,
        senderId: message.sender._id
      },
      actions: [
        {
          action: 'reply',
          title: 'Reply'
        },
        {
          action: 'mark-read',
          title: 'Mark as Read'
        }
      ]
    });
  }

  async registerServiceWorker() {
    if (!this.isServiceWorkerSupported) {
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration);
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }
}

export const notificationManager = new NotificationManager();