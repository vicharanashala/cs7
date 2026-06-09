// Yaksha-mini floating chatbot widget.
// Replaces the old ChatbotFab + ChatbotPage with an in-place overlay
// that matches the design at samagama.in/internship/faq#ym-panel.
// Only rendered for the student role (see AppShell).
import '../styles/yaksha-mini.css';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, ThumbsDown, ThumbsUp, TriangleAlert, WifiOff, X } from 'lucide-react';
import {
  useChatConversation,
  type DisplayMessage,
} from '../features/chatbot/useChatConversation';

const WELCOME: DisplayMessage = {
  role: 'assistant',
  content:
    "Hi — I'm Yaksha-mini. I answer strictly from this site's FAQ. Ask me about VINS, NOC, dates, stipend, or certificates.",
  sources: [],
};

/* ── SVG icons (matching the reference site) ──────────────────────────── */
function ChatBubbleIcon({ size = 26 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      width={size}
      height={size}
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* ── Main widget component ────────────────────────────────────────────── */
export function ChatbotFab() {
  const [open, setOpen] = useState(false);
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
  } = useChatConversation({ welcome: WELCOME, active: open });

  // Resize State
  const [dimensions, setDimensions] = useState({ width: 380, height: 580 });
  const isResizing = useRef(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* Auto-scroll on new messages */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  /* Focus the input when the panel opens */
  useEffect(() => {
    if (!open) return;
    // Small delay so the panel is rendered before we try to focus
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, [open]);

  /* Return focus to the input once a reply settles */
  useEffect(() => {
    if (open && !isTyping) inputRef.current?.focus();
  }, [open, isTyping]);

  // Resizing logic for Top, Left, and Top-Left edges
  const startResize = (direction: 'top' | 'left' | 'top-left', e: React.PointerEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = dimensions.width;
    const startHeight = dimensions.height;

    const onPointerMove = (moveEv: PointerEvent) => {
      if (!isResizing.current) return;
      const dx = startX - moveEv.clientX; // expanding left means dx is positive
      const dy = startY - moveEv.clientY; // expanding top means dy is positive

      setDimensions((prev) => {
        let newW = prev.width;
        let newH = prev.height;
        if (direction === 'left' || direction === 'top-left') {
          newW = Math.max(300, Math.min(startWidth + dx, window.innerWidth - 32));
        }
        if (direction === 'top' || direction === 'top-left') {
          newH = Math.max(400, Math.min(startHeight + dy, window.innerHeight - 32));
        }
        return { width: newW, height: newH };
      });
    };

    const onPointerUp = () => {
      isResizing.current = false;
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.body.style.cursor = ''; // reset global cursor
    };

    // set cursor globally to avoid cursor flickering when mouse moves faster than element
    if (direction === 'top') document.body.style.cursor = 'ns-resize';
    else if (direction === 'left') document.body.style.cursor = 'ew-resize';
    else document.body.style.cursor = 'nwse-resize';

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  };

  /* Grow textarea to fit content, capped at 120px */
  const growTextarea = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  /* Reset the textarea height, then delegate to the shared send logic. */
  const onSend = () => {
    if (inputRef.current) inputRef.current.style.height = 'auto';
    void send();
  };

  /* ── Launcher (visible when panel is closed) ────────────────────────── */
  if (!open) {
    return createPortal(
      <button
        type="button"
        className="ym-launcher"
        id="ym-launcher"
        aria-label="Open Yaksha-mini chat"
        data-tooltip="Open Yaksha-mini chat"
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          right: '1.5rem',
          bottom: '1.5rem',
          left: 'auto',
          top: 'auto',
          zIndex: 9000,
        }}
      >
        <span className="ym-launcher-tooltip">Ask Yaksha-mini</span>
        <ChatBubbleIcon />
      </button>,
      document.body,
    );
  }

  /* ── Chat panel (visible when open) ─────────────────────────────────── */
  return createPortal(
    <section
      className="yaksha-mini"
      id="ym-panel"
      aria-label="Yaksha-mini chat"
      style={
        {
          position: 'fixed',
          right: '1.5rem',
          bottom: '1.5rem',
          left: 'auto',
          top: 'auto',
          zIndex: 9100,
          '--ym-width': `${dimensions.width}px`,
          '--ym-height': `${dimensions.height}px`,
        } as React.CSSProperties
      }
    >
      <div className="ym-resize-handle top" onPointerDown={(e) => startResize('top', e)} />
      <div className="ym-resize-handle left" onPointerDown={(e) => startResize('left', e)} />
      <div
        className="ym-resize-handle top-left"
        onPointerDown={(e) => startResize('top-left', e)}
      />

      {/* Header */}
      <div className="yaksha-mini-head">
        <div className="ym-titles">
          <span className="ym-avatar" aria-hidden="true">
            <ChatBubbleIcon size={22} />
          </span>
          <span className="ym-title-stack">
            <span className="ym-title">Yaksha-mini</span>
            <span className="ym-sub">
              <span className="ym-online-dot" aria-hidden="true" />
              Answers from this site
            </span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {messages.length > 1 && (
            <button
              type="button"
              className="ym-close"
              aria-label="Start a new conversation"
              data-tooltip="New chat"
              onClick={() => void startNew()}
            >
              <Plus size={18} />
            </button>
          )}
          <button
            type="button"
            className="ym-close"
            id="ym-close"
            aria-label="Close chat"
            data-tooltip="Close chat"
            onClick={() => setOpen(false)}
          >
            &times;
          </button>
        </div>
      </div>

      {/* Ollama disconnected banner */}
      {ollamaError && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            margin: '0 10px 6px',
            background: 'color-mix(in srgb, #ef4444 12%, transparent)',
            border: '1px solid color-mix(in srgb, #ef4444 35%, transparent)',
            borderRadius: 8,
            fontSize: 12,
            color: '#ef4444',
            fontWeight: 600,
            lineHeight: 1.4,
          }}
        >
          <WifiOff size={13} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>
            Ollama is not connected. Start the Ollama service and try again.
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
            <X size={12} />
          </button>
        </div>
      )}

      {/* Chat log */}
      <div className="yaksha-mini-log" id="ym-log" role="log" aria-live="polite">
        {messages.map((m, i) => (
          <MessageBubble
            key={i}
            msg={m}
            displayIndex={i}
            sessionId={sessionId}
            onFeedback={handleFeedback}
            onPrefill={(text) => {
              setInput(text);
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
          />
        ))}

        {isTyping && (
          <div className="ym-msg thinking">
            <div className="ym-bubble">
              <span className="ym-dots">
                <span />
                <span />
                <span />
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input form */}
      <form
        className="yaksha-mini-form"
        id="ym-form"
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
      >
        <textarea
          ref={inputRef}
          id="ym-input"
          name="question"
          rows={1}
          placeholder="Type a question…"
          maxLength={500}
          aria-label="Your question for Yaksha-mini"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            growTextarea(e.target);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
        <button
          type="submit"
          className="ym-send-btn"
          id="ym-send-btn"
          aria-label="Send message"
          data-tooltip="Send message"
          disabled={!input.trim() || isSending}
        >
          <SendIcon />
        </button>
      </form>
    </section>,
    document.body,
  );
}

/* ── Message bubble sub-component ─────────────────────────────────────── */
interface MessageBubbleProps {
  msg: DisplayMessage;
  displayIndex: number;
  sessionId: string | null;
  onFeedback: (msgIdx: number, displayIdx: number, rating: 'helpful' | 'incorrect') => void;
  onPrefill: (text: string) => void;
}

function MessageBubble({ msg, displayIndex, sessionId, onFeedback, onPrefill }: MessageBubbleProps) {
  const isUser = msg.role === 'user';

  return (
    <div className={`ym-msg ${isUser ? 'user' : 'assistant'}`}>
      <div>
        <div className="ym-bubble">
          {msg.escalated && <TriangleAlert size={13} className="ym-escalated-icon" />}
          {msg.content}
        </div>

        {/* Escalate hint — shown only after a fallback response */}
        {!isUser && msg.fallback_triggered && (
          <button
            type="button"
            className="ym-escalate-hint"
            onClick={() => onPrefill('#escalate')}
          >
            ⚑ Type #escalate to flag this for a moderator
          </button>
        )}

        {/* Feedback buttons */}
        {!isUser && msg.messageIndex !== undefined && sessionId && (
          <div className="ym-feedback-row">
            <button
              type="button"
              className={`ym-fb-btn${msg.feedback === 'helpful' ? ' active-helpful' : msg.feedback === 'incorrect' ? ' ym-fb-inactive' : ''}`}
              title={msg.feedback === 'helpful' ? 'Click again to undo' : 'Mark as helpful'}
              onClick={() => onFeedback(msg.messageIndex!, displayIndex, 'helpful')}
            >
              <ThumbsUp size={10} /> Helpful
            </button>
            <button
              type="button"
              className={`ym-fb-btn${msg.feedback === 'incorrect' ? ' active-incorrect' : msg.feedback === 'helpful' ? ' ym-fb-inactive' : ''}`}
              title={msg.feedback === 'incorrect' ? 'Click again to undo' : 'Mark as not helpful'}
              onClick={() => onFeedback(msg.messageIndex!, displayIndex, 'incorrect')}
            >
              <ThumbsDown size={10} /> Not helpful
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
