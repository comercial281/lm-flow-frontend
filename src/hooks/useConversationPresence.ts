import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/authStore';

interface PresenceUser {
  id: number;
  name: string;
}

export function useConversationPresence(conversationId: number | string | undefined) {
  const [othersPresent, setOthersPresent] = useState<PresenceUser[]>([]);
  const currentUser = useAuthStore(s => s.currentUser);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!conversationId || !currentUser) return;

    const pubsubToken = (currentUser as any).pubsub_token;
    const userId = currentUser.id;
    if (!pubsubToken || !userId) return;

    const baseUrl = (import.meta.env.VITE_API_URL || '').replace(/^http/, 'ws');
    if (!baseUrl) return;

    const ws = new WebSocket(`${baseUrl}/cable`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        command: 'subscribe',
        identifier: JSON.stringify({
          channel: 'ConversationPresenceChannel',
          conversation_id: conversationId,
          user_id: userId,
          pubsub_token: pubsubToken,
        }),
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'ping' || msg.type === 'welcome' || msg.type === 'confirm_subscription') return;
        const data = msg.message;
        if (!data?.event) return;

        if (data.event === 'agent.entered' && data.user?.id !== userId) {
          setOthersPresent(prev => {
            const already = prev.find(u => u.id === data.user.id);
            if (already) return prev;
            return [...prev, { id: data.user.id, name: data.user.name }];
          });
        } else if (data.event === 'agent.left') {
          setOthersPresent(prev => prev.filter(u => u.id !== data.user?.id));
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => setOthersPresent([]);

    return () => {
      ws.close();
      setOthersPresent([]);
    };
  }, [conversationId, currentUser]);

  return { othersPresent };
}
