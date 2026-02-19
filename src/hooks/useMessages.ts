import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LoadMessage {
  id: string;
  load_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: 'dispatcher' | 'driver';
  message: string;
  read_by: string[];
  created_at: string;
}

export function useMessages(loadId: string | null, userId: string | null) {
  const [messages, setMessages] = useState<LoadMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!loadId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessages([]);

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('load_messages')
        .select('*')
        .eq('load_id', loadId)
        .order('created_at', { ascending: true });
      if (data) setMessages(data as LoadMessage[]);
      setLoading(false);
    };
    fetchMessages();

    const channel = supabase
      .channel(`messages-web:${loadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'load_messages',
          filter: `load_id=eq.${loadId}`,
        },
        (payload: { new: LoadMessage }) => {
          setMessages(prev => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadId]);

  const sendMessage = useCallback(
    async (
      message: string,
      senderName: string,
      senderRole: 'dispatcher' | 'driver'
    ) => {
      if (!loadId || !userId || !message.trim()) return;
      await supabase.from('load_messages').insert({
        load_id: loadId,
        sender_id: userId,
        sender_name: senderName,
        sender_role: senderRole,
        message: message.trim(),
        read_by: [userId],
      });
    },
    [loadId, userId]
  );

  const markAsRead = useCallback(async () => {
    if (!loadId || !userId) return;
    await supabase.rpc('mark_messages_read', {
      p_load_id: loadId,
      p_user_id: userId,
    });
  }, [loadId, userId]);

  return { messages, loading, sendMessage, markAsRead };
}

// ─── Unread count hook ────────────────────────────────────────────────────────
export function useUnreadMessageCounts(userId: string | null) {
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});

  const refresh = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.rpc('get_unread_message_counts', {
      p_user_id: userId,
    });
    if (data) {
      const map: Record<string, number> = {};
      for (const row of data as { load_id: string; unread_count: number }[]) {
        map[row.load_id] = Number(row.unread_count);
      }
      setUnreadMap(map);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    refresh();

    // Subscribe to new messages to update unread counts
    const channel = supabase
      .channel('unread-counts-watch')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'load_messages',
        },
        () => {
          refresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'load_messages',
        },
        () => {
          refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  return { unreadMap, refresh };
}
