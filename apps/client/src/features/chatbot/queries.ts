// React Query hooks wrapping the chatbot API calls.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ChatFeedbackInput,
  ChatQueryInput,
  ChatRetractFeedbackInput,
} from '@samagama/shared';
import {
  getActiveChatSession,
  getChatSession,
  retractChatFeedback,
  sendChatMessage,
  startNewChat,
  submitChatFeedback,
} from './api';

// Send a chat message (mutation — each send is a one-off request).
export function useSendMessage() {
  return useMutation({
    mutationFn: (input: ChatQueryInput) => sendChatMessage(input),
  });
}

// Load a chat session's history. Disabled until a sessionId exists; never goes stale
// (history is immutable once fetched and updated locally as new messages arrive).
export function useChatSession(sessionId: string | null) {
  return useQuery({
    queryKey: ['chat', 'session', sessionId],
    queryFn: () => getChatSession(sessionId!),
    enabled: !!sessionId,
    staleTime: Infinity,
  });
}

// The caller's active conversation thread, for auto-restore. Fetched once when the chat
// surface opens (staleTime Infinity — history is updated locally as messages arrive).
export function useActiveChatSession(enabled: boolean) {
  return useQuery({
    queryKey: ['chat', 'active'],
    queryFn: getActiveChatSession,
    enabled,
    staleTime: Infinity,
  });
}

// "Clear / Start new" — closes the active thread; invalidate the cached active session so
// the next open fetches the fresh (empty) thread.
export function useStartNewChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => startNewChat(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat', 'active'] });
    },
  });
}

// Submit feedback on a chatbot answer; refreshes the admin feedback list on success.
export function useSubmitChatFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ChatFeedbackInput) => submitChatFeedback(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chatbot', 'feedback'] });
    },
  });
}

// Retract a previously-submitted rating (undo an accidental thumbs-up/down).
export function useRetractChatFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ChatRetractFeedbackInput) => retractChatFeedback(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chatbot', 'feedback'] });
    },
  });
}
