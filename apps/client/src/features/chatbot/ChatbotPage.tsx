import { useEffect, useRef } from 'react';
import {
  BookOpen,
  Bot,
  MessageSquare,
  Send,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
  WifiOff,
  X,
} from 'lucide-react';
import { useChatConversation, type DisplayMessage } from './useChatConversation';

const WELCOME: DisplayMessage = {
  role: 'assistant',
  content:
    "Hello! I'm Yaksha, your Samagama Internship Portal assistant. Ask me anything about attendance, NOC, certificates, stipend, or internship guidelines.",
  sources: [],
};

export function ChatbotPage() {
  const {
    sessionId,
    messages,
    input,
    setInput,
    isTyping,
    ollamaError,
    setOllamaError,
    send,
    handleFeedback,
    startNew,
    isSending,
    elapsedSeconds,
  } = useChatConversation({ welcome: WELCOME, active: true });
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Return focus to the input once a reply settles.
  useEffect(() => {
    if (!isTyping) inputRef.current?.focus();
  }, [isTyping]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 80px)',
        maxWidth: 860,
        margin: '0 auto',
      }}
    >
      {/* Header card */}
      <div className="mod-card mod-card-blue" style={{ marginBottom: 14 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 20px 16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(124,58,237,0.3)',
              }}
            >
              <Bot size={20} color="white" />
            </div>
            <div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: 'var(--color-text)',
                  letterSpacing: '-0.01em',
                }}
              >
                Yaksha Chatbot
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--color-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 2,
                }}
              >
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: 'var(--color-success)',
                  }}
                />
                RAG-powered · Answers grounded in approved FAQs
              </div>
            </div>
          </div>
          {messages.length > 1 && (
            <button
              type="button"
              onClick={startNew}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 13px',
                background: 'var(--color-pill)',
                color: 'var(--color-text-muted)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'inherit',
              }}
            >
              <X size={12} /> New chat
            </button>
          )}
        </div>
      </div>

      {/* Ollama disconnected banner */}
      {ollamaError && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 16px',
            marginBottom: 10,
            background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)',
            borderRadius: 10,
            fontSize: 13,
            color: 'var(--color-danger)',
            fontWeight: 600,
          }}
        >
          <WifiOff size={16} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>
            Ollama is not connected. Please start the Ollama service and try again.
          </span>
          <button
            type="button"
            onClick={() => setOllamaError(false)}
            aria-label="Dismiss"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              padding: 2,
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
              opacity: 0.7,
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Messages */}
      <div
        style={{
          flex: 1,
          background: 'var(--color-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 18,
          padding: 16,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          marginBottom: 12,
        }}
      >
        {messages.map((m, i) => (
          <MessageBubble
            key={i}
            msg={m}
            displayIndex={i}
            sessionId={sessionId}
            onFeedback={handleFeedback}
          />
        ))}
        {isTyping && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <BotAvatar />
            <div
              style={{
                background: 'var(--color-input)',
                borderRadius: '4px 14px 14px 14px',
                padding: '12px 16px',
                fontSize: 14,
                color: 'var(--color-text-muted)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TypingDots />
                <span style={{ fontSize: 12 }}>
                  {elapsedSeconds > 0 ? `Thinking... (${elapsedSeconds}s)` : 'Thinking...'}
                </span>
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div
        style={{
          background: 'var(--color-card)',
          border: '1.5px solid var(--color-border)',
          borderRadius: 14,
          padding: '10px 14px',
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}
      >
        <MessageSquare size={16} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Ask Yaksha about your internship…"
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            outline: 'none',
            color: 'var(--color-text)',
            fontSize: 14,
            fontFamily: 'inherit',
          }}
        />
        <button
          type="button"
          onClick={send}
          disabled={!input.trim() || isSending}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            background: 'var(--color-primary)',
            color: 'white',
            border: 'none',
            borderRadius: 10,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'inherit',
            opacity: !input.trim() || isSending ? 0.5 : 1,
            boxShadow: '0 2px 8px rgba(124,58,237,0.25)',
            transition: 'opacity 0.15s',
          }}
        >
          <Send size={13} /> Send
        </button>
      </div>

      <div
        style={{
          fontSize: 11,
          color: 'var(--color-text-muted)',
          textAlign: 'center',
          marginTop: 7,
        }}
      >
        Type <strong>#escalate</strong> after a fallback response to flag your question for a
        moderator
      </div>
    </div>
  );
}

function BotAvatar() {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: 'var(--color-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 2px 6px rgba(124,58,237,0.25)',
      }}
    >
      <Bot size={16} color="white" />
    </div>
  );
}

function TypingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--color-text-muted)',
            animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </span>
  );
}

interface MessageBubbleProps {
  msg: DisplayMessage;
  displayIndex: number;
  sessionId: string | null;
  onFeedback: (msgIdx: number, displayIdx: number, rating: 'helpful' | 'incorrect') => void;
}

function MessageBubble({ msg, displayIndex, sessionId, onFeedback }: MessageBubbleProps) {
  const isUser = msg.role === 'user';
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        gap: 10,
        alignItems: 'flex-start',
      }}
    >
      {!isUser && <BotAvatar />}
      <div style={{ maxWidth: '72%' }}>
        <div
          style={{
            background: isUser ? 'var(--color-primary)' : 'var(--color-input)',
            color: isUser ? 'white' : 'var(--color-text)',
            borderRadius: isUser ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
            padding: '12px 16px',
            fontSize: 14,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
          }}
        >
          {msg.escalated && (
            <TriangleAlert
              size={14}
              style={{
                marginRight: 6,
                color: 'var(--color-success)',
                verticalAlign: 'text-bottom',
              }}
            />
          )}
          {msg.content}
        </div>

        {/* Source pills */}
        {!isUser && msg.sources && msg.sources.length > 0 && (
          <div style={{ marginTop: 7, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {msg.sources.map((s, j) => (
              <span
                key={j}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'var(--color-primary-bg)',
                  color: 'var(--color-primary-text)',
                  borderRadius: 20,
                  padding: '3px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                <BookOpen size={10} /> {s.title}
                <span style={{ opacity: 0.7 }}>({Math.round(s.similarity * 100)}%)</span>
              </span>
            ))}
          </div>
        )}

        {/* Feedback buttons */}
        {!isUser && msg.messageIndex !== undefined && sessionId && (
          <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
            <FeedbackBtn
              icon={<ThumbsUp size={11} />}
              label="Helpful"
              active={msg.feedback === 'helpful'}
              color="var(--color-success)"
              disabled={false}
              onClick={() => onFeedback(msg.messageIndex!, displayIndex, 'helpful')}
            />
            <FeedbackBtn
              icon={<ThumbsDown size={11} />}
              label="Not helpful"
              active={msg.feedback === 'incorrect'}
              color="var(--color-danger)"
              disabled={false}
              onClick={() => onFeedback(msg.messageIndex!, displayIndex, 'incorrect')}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function FeedbackBtn({
  icon,
  label,
  active,
  color,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  color: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        fontSize: 11,
        color: active ? color : 'var(--color-text-muted)',
        background: active ? `color-mix(in srgb, ${color} 12%, transparent)` : 'none',
        border: `1px solid ${active ? color : 'var(--color-border)'}`,
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontFamily: 'inherit',
        padding: '3px 8px',
        borderRadius: 20,
        opacity: disabled && !active ? 0.5 : 1,
        transition: 'all 0.15s',
      }}
    >
      {icon}
      {label}
    </button>
  );
}
