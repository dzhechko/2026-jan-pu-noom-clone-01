"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "@/lib/api-client";
import { AppShell } from "@/components/layout/app-shell";
import { MessageBubble } from "@/components/coach/message-bubble";
import { ChatInput } from "@/components/coach/chat-input";
import { SuggestedChips } from "@/components/coach/suggested-chips";
import { Spinner } from "@/components/ui/spinner";
import { COACH_SUGGESTED_QUESTIONS } from "@vesna/shared";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface CoachSendResponse {
  message: ChatMessage;
  suggestedQuestions: string[];
}

export default function CoachPage(): React.JSX.Element {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>(
    COACH_SUGGESTED_QUESTIONS[0] ?? [],
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback((): void => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Fetch message history
  useEffect(() => {
    api
      .get<{ messages: ChatMessage[] }>("/api/coach/messages")
      .then((res) => {
        if (res.data) {
          setMessages(res.data.messages);
          // If there are existing messages, clear default suggestions
          if (res.data.messages.length > 0) {
            setSuggestions([]);
          }
        }
      })
      .catch(() => {
        setError("Не удалось загрузить историю чата");
      })
      .finally(() => setLoading(false));
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function handleSend(message: string): Promise<void> {
    setError(null);
    setSending(true);
    setSuggestions([]);

    // Optimistically add user message
    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const res = await api.post<CoachSendResponse>("/api/coach/message", {
        message,
      });

      if (res.data) {
        // Replace temp user message with actual response, add assistant message
        setMessages((prev) => {
          const withoutTemp = prev.filter((m) => m.id !== userMessage.id);
          return [
            ...withoutTemp,
            { ...userMessage, id: `user-${Date.now()}` },
            res.data!.message,
          ];
        });
        setSuggestions(res.data.suggestedQuestions ?? []);
      } else {
        setError(res.error?.message ?? "Ошибка при отправке сообщения");
      }
    } catch {
      setError("Ошибка при отправке сообщения");
    } finally {
      setSending(false);
    }
  }

  function handleSuggestionSelect(suggestion: string): void {
    handleSend(suggestion);
  }

  if (loading) {
    return (
      <AppShell title="AI Коуч" showNav={false}>
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="AI Коуч" showNav={false}>
      <div className="flex flex-col" style={{ height: "calc(100vh - 56px - 60px)" }}>
        {/* Messages area */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-4 py-4"
        >
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-tg-button/10">
                <svg
                  className="h-8 w-8 text-tg-button"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                  />
                </svg>
              </div>
              <h2 className="mb-1 text-base font-semibold text-tg-text">
                Ваш AI коуч
              </h2>
              <p className="max-w-xs text-sm text-tg-hint">
                Задайте вопрос о когнитивно-поведенческих техниках для управления весом
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                createdAt={msg.createdAt}
              />
            ))}

            {/* Typing indicator */}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-tg-secondary-bg px-4 py-3">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-tg-hint [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-tg-hint [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-tg-hint [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-4 mb-2 rounded-xl bg-vesna-red/10 px-4 py-2">
            <p className="text-xs font-medium text-vesna-red">{error}</p>
          </div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && !sending && (
          <div className="px-4 pb-2">
            <SuggestedChips
              suggestions={suggestions}
              onSelect={handleSuggestionSelect}
            />
          </div>
        )}

        {/* Chat input */}
        <ChatInput onSend={handleSend} disabled={sending} />
      </div>
    </AppShell>
  );
}
