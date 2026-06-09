import { NavLink } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import type { UserRole } from '@samagama/shared';
import { navByRole, type NavItem } from './navigation';
import { useAuth } from '../features/auth/AuthProvider';

interface SidebarProps {
  role: UserRole;
  userName: string;
  open: boolean;
  onToggle: () => void;
}

export function Sidebar({ role, userName, open }: SidebarProps) {
  const items = navByRole[role];
  const { logout } = useAuth();
  const groups = groupBySection(items);

  const initials = userName
    .split(' ')
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');

  return (
    <aside className="sidebar" style={{ width: open ? 236 : 60 }}>
      {/* ── Brand ──────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: open ? '16px 16px 14px' : '14px 0',
          borderBottom: '1px solid var(--color-sidebar-border)',
          display: 'flex',
          justifyContent: open ? 'flex-start' : 'center',
          flexShrink: 0,
        }}
      >
        {open ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="sidebar-logo">S</div>
            <div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: 'var(--color-sidebar-username)',
                  letterSpacing: '-0.3px',
                  lineHeight: 1.2,
                }}
              >
                Samagama
              </div>
              <div
                style={{ fontSize: 10, color: 'var(--color-sidebar-sub)', marginTop: 2 }}
                data-testid="role-label"
              >
                Internship Portal · {role}
              </div>
            </div>
          </div>
        ) : (
          <div className="sidebar-logo">S</div>
        )}
      </div>

      {/* ── Nav ────────────────────────────────────────────────────────── */}
      <nav style={{ flex: 1, padding: '8px 8px', overflowY: 'auto' }}>
        {groups.map((group, gi) => (
          <div key={gi} style={{ marginBottom: 8 }}>
            {open && group.section && <div className="sidebar-section-label">{group.section}</div>}
            {group.items.map((item) => (
              <SidebarLink key={item.path} item={item} open={open} />
            ))}
          </div>
        ))}
      </nav>

      {/* ── User footer ────────────────────────────────────────────────── */}
      <div
        style={{
          padding: open ? '10px 12px' : '10px 0',
          borderTop: '1px solid var(--color-sidebar-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: open ? 'flex-start' : 'center',
          gap: open ? 10 : 0,
          flexShrink: 0,
        }}
      >
        {/* Avatar */}
        <div
          title={open ? undefined : userName}
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
            color: 'white',
            flexShrink: 0,
            cursor: 'default',
            boxShadow: '0 0 0 2px var(--color-sidebar-border)',
          }}
        >
          {initials}
        </div>

        {open ? (
          <>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--color-sidebar-username)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {userName}
              </div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  marginTop: 2,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: 'var(--color-sidebar-active-text)',
                  background: 'var(--color-sidebar-active)',
                  borderRadius: 4,
                  padding: '1px 6px',
                }}
              >
                {role}
              </div>
            </div>

            <button
              onClick={logout}
              title="Sign out"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-sidebar-logout)',
                padding: 6,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                transition: 'color var(--transition), background var(--transition)',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.color = 'var(--color-sidebar-text-hover)';
                el.style.background = 'var(--color-sidebar-hover)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.color = 'var(--color-sidebar-logout)';
                el.style.background = 'none';
              }}
            >
              <LogOut size={14} />
            </button>
          </>
        ) : (
          <button
            onClick={logout}
            title="Sign out"
            style={{
              position: 'absolute',
              bottom: 52,
              left: 0,
              width: 60,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '7px 0',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-sidebar-logout)',
              transition: 'color var(--transition)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color =
                'var(--color-sidebar-text-hover)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-sidebar-logout)';
            }}
          >
            <LogOut size={15} />
          </button>
        )}
      </div>
    </aside>
  );
}

function SidebarLink({ item, open }: { item: NavItem; open: boolean }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      end
      title={open ? undefined : item.label}
      className={({ isActive }) =>
        ['sidebar-link', isActive ? 'active' : ''].filter(Boolean).join(' ')
      }
      style={() => ({
        gap: open ? 10 : 0,
        justifyContent: open ? 'flex-start' : 'center',
        padding: open ? '9px 10px 9px 9px' : '9px',
      })}
    >
      {({ isActive }) => (
        <>
          {open ? (
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                background: isActive ? 'var(--color-sidebar-active)' : 'transparent',
                transition: 'background var(--transition)',
              }}
            >
              <Icon size={15} />
            </div>
          ) : (
            <Icon size={16} style={{ flexShrink: 0 }} />
          )}

          {open && (
            <span
              style={{
                flex: 1,
                textAlign: 'left',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item.label}
            </span>
          )}

          {open && item.badge && (
            <span
              style={{
                background: '#ef4444',
                color: 'white',
                borderRadius: 10,
                padding: '1px 6px',
                fontSize: 10,
                fontWeight: 700,
                minWidth: 18,
                textAlign: 'center',
              }}
            >
              {item.badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

function groupBySection(items: NavItem[]): { section?: string; items: NavItem[] }[] {
  const groups: { section?: string; items: NavItem[] }[] = [];
  for (const item of items) {
    if (item.section || groups.length === 0) {
      groups.push({ section: item.section, items: [item] });
    } else {
      groups[groups.length - 1]!.items.push(item);
    }
  }
  return groups;
}
