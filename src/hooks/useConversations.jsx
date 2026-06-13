import { useState, useCallback } from 'react';
import { supabase } from '@/utils/supabaseClient';

export function useConversations(user) {
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    setLoadingHistory(true);
    const { data } = await supabase
      .from('conversations')
      .select('id, title, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    setConversations(data || []);
    setLoadingHistory(false);
  }, [user]);

  const saveConversation = useCallback(async (messages, conversationId, titleOverride) => {
    if (!user || messages.length === 0) return conversationId;
    const firstUserMsg = messages.find(m => m.role === 'user');
    const title = titleOverride || (firstUserMsg?.content || 'New Chat').slice(0, 60);

    if (!conversationId) {
      const { data } = await supabase
        .from('conversations')
        .insert({ user_id: user.id, title, messages })
        .select('id')
        .single();
      return data?.id ?? null;
    }

    await supabase
      .from('conversations')
      .update({ messages, updated_at: new Date().toISOString() })
      .eq('id', conversationId);
    return conversationId;
  }, [user]);

  const loadConversationMessages = useCallback(async (id) => {
    const { data } = await supabase
      .from('conversations')
      .select('messages')
      .eq('id', id)
      .single();
    return data?.messages ?? null;
  }, []);

  const renameConversation = useCallback(async (id, newTitle) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    await supabase
      .from('conversations')
      .update({ title: trimmed })
      .eq('id', id);
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title: trimmed } : c));
  }, []);

  const deleteConversation = useCallback(async (id) => {
    await supabase
      .from('conversations')
      .delete()
      .eq('id', id);
    setConversations(prev => prev.filter(c => c.id !== id));
  }, []);

  return {
    conversations,
    currentConversationId,
    setCurrentConversationId,
    loadingHistory,
    loadConversations,
    saveConversation,
    loadConversationMessages,
    renameConversation,
    deleteConversation,
  };
}
