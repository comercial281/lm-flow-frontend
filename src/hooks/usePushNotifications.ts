import { useEffect, useState, useCallback } from 'react';
import {
  subscribeToPush,
  unsubscribeFromPush,
  isPushSubscribed,
} from '@/services/pushNotificationService';

export type PushStatus = 'loading' | 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed';

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>('loading');

  const isSupported =
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  useEffect(() => {
    if (!isSupported) {
      setStatus('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }
    isPushSubscribed().then((subscribed: boolean) => {
      setStatus(subscribed ? 'subscribed' : 'unsubscribed');
    });
  }, [isSupported]);

  const subscribe = useCallback(async () => {
    const ok = await subscribeToPush();
    setStatus(ok ? 'subscribed' : Notification.permission === 'denied' ? 'denied' : 'unsubscribed');
    return ok;
  }, []);

  const unsubscribe = useCallback(async () => {
    await unsubscribeFromPush();
    setStatus('unsubscribed');
  }, []);

  return { status, subscribe, unsubscribe, isSupported };
}
