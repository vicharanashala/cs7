import { useEffect, useRef, useState } from 'react';
import { useExclusiveOpen } from '../hooks/useExclusiveOpen';
import { Outlet, useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, Menu, Moon, Sun } from 'lucide-react';
import { useAuth } from '../features/auth/AuthProvider';
import { useTheme } from '../features/theme/ThemeProvider';
import { Sidebar } from './Sidebar';
import { ChatbotFab } from './ChatbotFab';
import { GlobalTooltip } from '../components/ui/GlobalTooltip';
import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
} from '../features/notifications/queries';
import type { PublicNotification } from '@samagama/shared';

export function AppShell() {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);

  if (!user) return null;

  return (
    <>
      <GlobalTooltip />
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Sidebar
          role={user.role}
          userName={user.name}
          open={sidebarOpen}
          onToggle={() => setSidebarOpen((v) => !v)}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <header
            style={{
              background: 'var(--color-topbar)',
              borderBottom: '1px solid var(--color-border)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              padding: '0 20px',
              height: 56,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexShrink: 0,
            }}
          >
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="Toggle sidebar"
              data-tooltip="Toggle sidebar"
              className="topbar-icon-btn"
            >
              <Menu size={18} />
            </button>

            {/* Spacer — pushes right-side controls to the trailing edge */}
            <div style={{ flex: 1 }} />

            {/* Notification bell — students only */}
            {user.role === 'student' && <NotificationBell />}

            <button
              onClick={toggle}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              className="topbar-icon-btn"
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </header>

          <main style={{ flex: 1, overflowY: 'auto', padding: '22px 24px' }}>
            <Outlet />
          </main>
        </div>
      </div>
      {user.role === 'student' && <ChatbotFab />}
    </>
  );
}

// ─── Notification bell + dropdown ────────────────────────────────────────────

function NotificationBell() {
  const { isOpen: open, toggle, close } = useExclusiveOpen('notification-bell');
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { data: unreadCount = 0 } = useUnreadCount();
  const { data: notifications = [] } = useNotifications();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  // Close on outside click — only active while dropdown is open
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, close]);

  const handleClick = (n: PublicNotification) => {
    if (!n.read) markRead.mutate(n.id);
    if (n.relatedId) {
      navigate(`/community/${n.relatedId}`);
      close();
    }
  };

  const ICON: Record<string, string> = {
    answer_approved: '✅',
    answer_rejected: '❌',
    question_answered: '💬',
    flag_reviewed: '🏁',
    general: '🔔',
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        aria-label="Notifications"
        data-tooltip="Notifications"
        className="topbar-icon-btn"
        style={{ position: 'relative' }}
        onClick={toggle}
      >
        <Bell size={18} />
        <span
          aria-live="polite"
          aria-atomic="true"
          aria-label={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : undefined}
          style={{
            position: 'absolute',
            top: 5,
            right: 5,
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            background: '#ef4444',
            border: '1.5px solid var(--color-topbar)',
            fontSize: 9,
            fontWeight: 800,
            color: 'white',
            display: unreadCount > 0 ? 'flex' : 'none',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
            lineHeight: 1,
          }}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            zIndex: 2000,
            width: 360,
            maxHeight: 480,
            overflowY: 'auto',
            background: 'var(--color-card)',
            borderRadius: 14,
            boxShadow: '0 12px 40px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08)',
            border: '1px solid var(--color-border)',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px 10px',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bell size={15} color="var(--color-primary)" />
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '1px 7px',
                    borderRadius: 10,
                    background: 'var(--color-primary)',
                    color: 'white',
                  }}
                >
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                data-tooltip="Mark all as read"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--color-primary)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  padding: '3px 6px',
                  borderRadius: 6,
                }}
              >
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          {notifications.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center' }}>
              <Bell size={28} color="var(--color-border)" style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)' }}>
                No notifications yet
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                You'll be notified about your answers and activity here.
              </div>
            </div>
          ) : (
            <div>
              {notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleClick(n)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    width: '100%',
                    padding: '12px 16px',
                    textAlign: 'left',
                    background: n.read ? 'none' : 'var(--color-primary-bg)',
                    border: 'none',
                    borderBottom: '1px solid var(--color-border)',
                    cursor: n.relatedId ? 'pointer' : 'default',
                    fontFamily: 'inherit',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={(e) => {
                    if (n.relatedId)
                      (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-pill)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = n.read
                      ? 'none'
                      : 'var(--color-primary-bg)';
                  }}
                >
                  {/* Icon */}
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      background: n.read ? 'var(--color-input)' : 'var(--color-primary-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      flexShrink: 0,
                      border: `1px solid ${n.read ? 'var(--color-border)' : 'var(--color-primary)'}`,
                    }}
                  >
                    {ICON[n.type] ?? '🔔'}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: n.read ? 500 : 700,
                          color: 'var(--color-text)',
                          lineHeight: 1.3,
                          marginBottom: 3,
                        }}
                      >
                        {n.title}
                      </div>
                      {!n.read && (
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: 'var(--color-primary)',
                            flexShrink: 0,
                            marginTop: 3,
                          }}
                        />
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--color-text-muted)',
                        lineHeight: 1.5,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {n.body}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                      {timeAgo(n.createdAt)}
                    </div>
                  </div>

                  {/* Mark read button */}
                  {!n.read && (
                    <button
                      type="button"
                      data-tooltip="Mark as read"
                      onClick={(e) => {
                        e.stopPropagation();
                        markRead.mutate(n.id);
                      }}
                      style={{
                        flexShrink: 0,
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-card)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: 2,
                      }}
                    >
                      <Check size={12} color="var(--color-text-muted)" />
                    </button>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}
