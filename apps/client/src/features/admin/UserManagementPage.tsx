// User Management — admin-only page for managing portal users.
import { useState, useRef, useEffect } from 'react';
import {
  Search,
  Users,
  GraduationCap,
  Shield,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  ChevronUp,
  Lock,
} from 'lucide-react';
import type { UserRole } from '@samagama/shared';
import type { PublicUserAdmin } from '@samagama/shared';
import { hasAdminAccess } from '@samagama/shared';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { useAuth } from '../auth/AuthProvider';
import { useUsers, useChangeRole, useSuspendUser, useActivateUser, useDeleteUser } from './queries';

type RoleFilter = 'all' | UserRole;
type StatusFilter = 'all' | 'active' | 'suspended';
type SortField = 'name' | 'createdAt';
type SortDir = 'asc' | 'desc';

// ── Colour palette ─────────────────────────────────────────────────────────────
const C = {
  border:      'var(--color-border)',
  bg:          'var(--color-card)',
  surface:     'var(--color-input)',
  text:        'var(--color-text)',
  muted:       'var(--color-text-muted)',
  primary:     'var(--color-primary)',
  primaryBg:   'var(--color-primary-bg)',
  adminBg:     'var(--color-danger-bg)',
  adminText:   'var(--color-danger)',
  adminBorder: 'color-mix(in srgb, var(--color-danger) 35%, transparent)',
  tAdminBg:    'var(--color-primary-bg)',
  tAdminText:  'var(--color-primary)',
  tAdminBorder:'color-mix(in srgb, var(--color-primary) 35%, transparent)',
  modBg:       'var(--color-orange-bg)',
  modText:     'var(--color-orange)',
  modBorder:   'color-mix(in srgb, var(--color-orange) 35%, transparent)',
  tModBg:      'var(--color-warning-bg)',
  tModText:    'var(--color-warning)',
  tModBorder:  'color-mix(in srgb, var(--color-warning) 35%, transparent)',
  stuBg:       'var(--color-info-bg)',
  stuText:     'var(--color-info)',
  stuBorder:   'color-mix(in srgb, var(--color-info) 35%, transparent)',
  activeDot:   'var(--color-success)',
  suspDot:     'var(--color-danger)',
  danger:      'var(--color-danger)',
  dangerBg:    'var(--color-danger-bg)',
  dangerBorder:'color-mix(in srgb, var(--color-danger) 35%, transparent)',
  warn:        'var(--color-warning)',
  warnBg:      'var(--color-warning-bg)',
  warnBorder:  'color-mix(in srgb, var(--color-warning) 35%, transparent)',
};

const AVATAR_COLORS = [
  '#6366f1',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#ef4444',
  '#14b8a6',
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ── Dialog types ──────────────────────────────────────────────────────────────

type DialogKind =
  | 'promote-t-mod'
  | 'revert-student'
  | 'promote-t-admin'
  | 'revert-moderator'
  | 'suspend'
  | 'activate'
  | 'delete';

interface DialogState {
  kind: DialogKind;
  user: PublicUserAdmin;
}

const DIALOG_META: Record<
  DialogKind,
  {
    title: string;
    body: (name: string) => string;
    passwordNote?: string;
    irreversible?: boolean;
    confirmLabel: string;
    confirmColor: string;
  }
> = {
  'promote-t-mod': {
    title: 'Promote to T-Moderator',
    body: (name) =>
      `${name} will be promoted from Student to T-Moderator and will gain moderation access.`,
    passwordNote: 'Password will be reset to Moderator@2026.',
    confirmLabel: 'Promote',
    confirmColor: C.tModText,
  },
  'revert-student': {
    title: 'Revert to Student',
    body: (name) =>
      `${name} will be reverted from T-Moderator back to Student and will lose moderation access.`,
    passwordNote: 'Password will be reset to Student@2026.',
    confirmLabel: 'Revert',
    confirmColor: C.stuText,
  },
  'promote-t-admin': {
    title: 'Promote to T-Admin',
    body: (name) =>
      `${name} will be promoted from Moderator to T-Admin and will gain temporary admin access.`,
    passwordNote: 'Password will be reset to Admin@2026.',
    confirmLabel: 'Promote',
    confirmColor: C.tAdminText,
  },
  'revert-moderator': {
    title: 'Revert to Moderator',
    body: (name) => `${name} will be reverted from T-Admin back to Moderator.`,
    passwordNote: 'Password will be reset to Moderator@2026.',
    confirmLabel: 'Revert',
    confirmColor: C.modText,
  },
  suspend: {
    title: 'Suspend Account',
    body: (name) =>
      `${name}'s account will be suspended. They will be unable to log in or access the application.`,
    confirmLabel: 'Suspend',
    confirmColor: C.danger,
  },
  activate: {
    title: 'Reactivate Account',
    body: (name) =>
      `${name}'s account will be reactivated and they will regain full access to the application.`,
    confirmLabel: 'Reactivate',
    confirmColor: C.activeDot,
  },
  delete: {
    title: 'Permanently Delete User',
    body: (name) =>
      `${name}'s account and all associated data (questions, answers, votes, feedback) will be permanently removed.`,
    irreversible: true,
    confirmLabel: 'Delete Permanently',
    confirmColor: C.danger,
  },
};

// ── Main page ──────────────────────────────────────────────────────────────────

export function UserManagementPage() {
  const { user: viewer } = useAuth();
  // A temporary admin (t-admin) gets the same management capabilities as a full admin.
  const isFullAdmin = !!viewer && hasAdminAccess(viewer.role);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const params = {
    page,
    pageSize,
    ...(roleFilter !== 'all' ? { role: roleFilter } : {}),
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    ...(search ? { q: search } : {}),
  };

  const { data, isLoading } = useUsers(params);
  const changeRole = useChangeRole();
  const suspendUser = useSuspendUser();
  const activateUser = useActivateUser();
  const deleteUser = useDeleteUser();

  const totalPages = data?.meta?.totalPages ?? 1;
  const total = data?.meta?.total ?? 0;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function openDialog(kind: DialogKind, user: PublicUserAdmin) {
    setOpenMenu(null);
    setDialog({ kind, user });
  }

  function confirmDialog() {
    if (!dialog) return;
    const { kind, user } = dialog;
    setDialog(null);

    const roleMap: Partial<Record<DialogKind, UserRole>> = {
      'promote-t-mod': 't-moderator',
      'revert-student': 'student',
      'promote-t-admin': 't-admin',
      'revert-moderator': 'moderator',
    };

    if (roleMap[kind]) {
      changeRole.mutate({ userId: user.id, role: roleMap[kind]! });
    } else if (kind === 'suspend') {
      suspendUser.mutate(user.id);
    } else if (kind === 'activate') {
      activateUser.mutate(user.id);
    } else if (kind === 'delete') {
      deleteUser.mutate(user.id);
    }
  }

  const GRID = '48px 1fr 1.4fr 160px 110px 90px';

  return (
    <div>
      <SectionHeader title="User Management" sub="Manage portal users — roles and access." />

      {/* Search + Filters */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 14,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {/* Search */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            background: C.bg,
            border: `1.5px solid ${C.border}`,
            borderRadius: 12,
            padding: '9px 16px',
            flex: '1 1 240px',
            maxWidth: 340,
            boxShadow: '0 1px 3px rgba(0,0,0,.04)',
          }}
        >
          <Search size={15} color={C.muted} style={{ flexShrink: 0 }} />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name or email..."
            style={{
              border: 'none',
              background: 'none',
              outline: 'none',
              fontSize: 13,
              color: C.text,
              fontFamily: 'inherit',
              width: '100%',
            }}
          />
        </div>

        {/* Role dropdown */}
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value as RoleFilter);
              setPage(1);
            }}
            style={{
              appearance: 'none',
              WebkitAppearance: 'none',
              fontSize: 12,
              fontWeight: 500,
              padding: '8px 32px 8px 12px',
              borderRadius: 10,
              border: `1.5px solid ${roleFilter !== 'all' ? C.primary : C.border}`,
              background: roleFilter !== 'all' ? C.primaryBg : C.bg,
              color: roleFilter !== 'all' ? C.primary : C.text,
              fontFamily: 'inherit',
              cursor: 'pointer',
              outline: 'none',
              boxShadow: '0 1px 3px rgba(0,0,0,.04)',
            }}
          >
            <option value="all">All Roles</option>
            <option value="student">Student</option>
            <option value="t-moderator">T-Moderator</option>
            <option value="moderator">Moderator</option>
            <option value="t-admin">T-Admin</option>
            <option value="admin">Admin</option>
          </select>
          <ChevronDown
            size={12}
            color={roleFilter !== 'all' ? C.primary : C.muted}
            style={{ position: 'absolute', right: 10, pointerEvents: 'none' }}
          />
        </div>

        {/* Status dropdown */}
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as StatusFilter);
              setPage(1);
            }}
            style={{
              appearance: 'none',
              WebkitAppearance: 'none',
              fontSize: 12,
              fontWeight: 500,
              padding: '8px 32px 8px 12px',
              borderRadius: 10,
              border: `1.5px solid ${statusFilter !== 'all' ? C.primary : C.border}`,
              background: statusFilter !== 'all' ? C.primaryBg : C.bg,
              color: statusFilter !== 'all' ? C.primary : C.text,
              fontFamily: 'inherit',
              cursor: 'pointer',
              outline: 'none',
              boxShadow: '0 1px 3px rgba(0,0,0,.04)',
            }}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
          <ChevronDown
            size={12}
            color={statusFilter !== 'all' ? C.primary : C.muted}
            style={{ position: 'absolute', right: 10, pointerEvents: 'none' }}
          />
        </div>
      </div>

      {/* Table card */}
      <div
        style={{
          background: C.bg,
          border: `1.5px solid ${C.border}`,
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 1px 4px rgba(0,0,0,.06)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: GRID,
            padding: '11px 20px',
            background: C.surface,
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          {(['#', 'NAME', 'EMAIL', 'ROLE', 'STATUS', 'ACTIONS'] as const).map((label, i) => {
            const sortable: (SortField | null)[] = [null, 'name', null, null, null, null];
            const sf = sortable[i];
            return (
              <div
                key={i}
                onClick={sf ? () => toggleSort(sf) : undefined}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.muted,
                  textTransform: 'uppercase',
                  letterSpacing: '.6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: sf ? 'pointer' : 'default',
                  userSelect: 'none',
                }}
              >
                {label}
                {sf &&
                  (sortField === sf ? (
                    sortDir === 'asc' ? (
                      <ChevronUp size={11} />
                    ) : (
                      <ChevronDown size={11} />
                    )
                  ) : (
                    <ChevronDown size={11} style={{ opacity: 0.35 }} />
                  ))}
              </div>
            );
          })}
        </div>

        {isLoading && (
          <div style={{ padding: '24px 20px', fontSize: 13, color: C.muted }}>Loading…</div>
        )}

        {!isLoading && (data?.items.length ?? 0) === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: 13, color: C.muted }}>
            No users match the current filters.
          </div>
        )}

        <div ref={menuRef}>
          {data?.items.map((user, i) => {
            const rowNum = String((page - 1) * pageSize + i + 1).padStart(2, '0');
            const bg = avatarColor(user.name);
            const isMenuOpen = openMenu === user.id;
            const isSystemAdmin = user.role === 'admin';

            return (
              <div
                key={user.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: GRID,
                  padding: '13px 20px',
                  alignItems: 'center',
                  borderBottom: i < data.items.length - 1 ? `1px solid ${C.border}` : 'none',
                  transition: 'background .1s',
                  background: isSystemAdmin ? '#fdfcfc' : undefined,
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = isSystemAdmin ? '#fdfcfc' : '#fafafa')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = isSystemAdmin ? '#fdfcfc' : '')
                }
              >
                {/* # badge */}
                <div>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: C.primaryBg,
                      color: C.primary,
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '.3px',
                    }}
                  >
                    {rowNum}
                  </span>
                </div>

                {/* Name + avatar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      background: bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: 14,
                      flexShrink: 0,
                    }}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.text,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {user.name}
                  </span>
                </div>

                {/* Email */}
                <div
                  style={{
                    fontSize: 12,
                    color: C.muted,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {user.email}
                </div>

                {/* Role badge */}
                <div>
                  <RoleBadge role={user.role} />
                </div>

                {/* Status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      flexShrink: 0,
                      background: user.status === 'active' ? C.activeDot : C.suspDot,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: user.status === 'active' ? C.activeDot : C.suspDot,
                    }}
                  >
                    {user.status === 'active' ? 'Active' : 'Suspended'}
                  </span>
                </div>

                {/* Actions */}
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}
                >
                  {isSystemAdmin ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        fontSize: 11,
                        fontWeight: 600,
                        color: C.muted,
                        background: C.surface,
                        border: `1px solid ${C.border}`,
                        borderRadius: 20,
                        padding: '3px 10px',
                      }}
                    >
                      <Lock size={10} />
                      Protected
                    </span>
                  ) : isFullAdmin ? (
                    <div style={{ position: 'relative' }}>
                      <button
                        aria-label="User actions"
                        onClick={() => setOpenMenu(isMenuOpen ? null : user.id)}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          border: `1.5px solid ${isMenuOpen ? C.primary : C.border}`,
                          background: isMenuOpen ? C.primaryBg : C.bg,
                          color: isMenuOpen ? C.primary : C.muted,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <MoreVertical size={14} />
                      </button>

                      {isMenuOpen && (
                        <ActionsMenu user={user} onAction={(kind) => openDialog(kind, user)} />
                      )}
                    </div>
                  ) : (
                    <span style={{ fontSize: 11, color: C.muted }}>—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 20px',
            borderTop: `1px solid ${C.border}`,
            background: C.surface,
          }}
        >
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: C.muted }}
          >
            <Users size={14} />
            Showing <strong style={{ color: C.text }}>{from}</strong> to{' '}
            <strong style={{ color: C.text }}>{to}</strong> of{' '}
            <strong style={{ color: C.text }}>{total}</strong> users
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Page size picker */}
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                style={{
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  fontSize: 12,
                  fontWeight: 500,
                  padding: '5px 28px 5px 10px',
                  borderRadius: 8,
                  border: `1.5px solid ${C.border}`,
                  background: C.bg,
                  color: C.text,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {[5, 10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n} per page
                  </option>
                ))}
              </select>
              <ChevronDown
                size={12}
                color={C.muted}
                style={{ position: 'absolute', right: 8, pointerEvents: 'none' }}
              />
            </div>

            {/* Page buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <PageBtn disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft size={14} />
              </PageBtn>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                  if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === '...' ? (
                    <span key={`e${i}`} style={{ fontSize: 12, color: C.muted, padding: '0 4px' }}>
                      …
                    </span>
                  ) : (
                    <PageBtn key={p} active={p === page} onClick={() => setPage(p as number)}>
                      {p}
                    </PageBtn>
                  ),
                )}
              <PageBtn disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight size={14} />
              </PageBtn>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation dialog */}
      {dialog && (
        <ConfirmDialog dialog={dialog} onCancel={() => setDialog(null)} onConfirm={confirmDialog} />
      )}
    </div>
  );
}

// ── Actions menu ───────────────────────────────────────────────────────────────

function ActionsMenu({
  user,
  onAction,
}: {
  user: PublicUserAdmin;
  onAction: (kind: DialogKind) => void;
}) {
  const role = user.role;
  const isActive = user.status === 'active';

  const items: { label: string; kind: DialogKind; color?: string }[] = [];

  if (role === 'student') {
    items.push({ label: 'Promote to T-Moderator', kind: 'promote-t-mod', color: C.tModText });
    items.push({
      label: isActive ? 'Suspend Account' : 'Reactivate Account',
      kind: isActive ? 'suspend' : 'activate',
      color: isActive ? C.danger : C.activeDot,
    });
    items.push({ label: 'Delete User', kind: 'delete', color: C.danger });
  } else if (role === 't-moderator') {
    items.push({ label: 'Revert to Student', kind: 'revert-student', color: C.stuText });
    items.push({
      label: isActive ? 'Suspend Account' : 'Reactivate Account',
      kind: isActive ? 'suspend' : 'activate',
      color: isActive ? C.danger : C.activeDot,
    });
  } else if (role === 'moderator') {
    items.push({ label: 'Promote to T-Admin', kind: 'promote-t-admin', color: C.tAdminText });
  } else if (role === 't-admin') {
    items.push({ label: 'Revert to Moderator', kind: 'revert-moderator', color: C.modText });
  }

  if (items.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        right: 0,
        top: 38,
        zIndex: 30,
        background: C.bg,
        border: `1.5px solid ${C.border}`,
        borderRadius: 10,
        boxShadow: '0 4px 16px rgba(0,0,0,.1)',
        minWidth: 192,
        overflow: 'hidden',
      }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => onAction(item.kind)}
          style={{
            width: '100%',
            padding: '10px 14px',
            border: 'none',
            background: 'none',
            textAlign: 'left',
            fontSize: 12,
            fontWeight: 500,
            color: item.color ?? C.text,
            cursor: 'pointer',
            fontFamily: 'inherit',
            borderTop: i > 0 && item.kind === 'delete' ? `1px solid ${C.border}` : 'none',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = C.surface)}
          onMouseLeave={(e) => (e.currentTarget.style.background = '')}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

// ── Confirmation dialog ────────────────────────────────────────────────────────

function ConfirmDialog({
  dialog,
  onCancel,
  onConfirm,
}: {
  dialog: DialogState;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const meta = DIALOG_META[dialog.kind];
  const { user } = dialog;
  const isDelete = dialog.kind === 'delete';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          background: C.bg,
          borderRadius: 16,
          width: '100%',
          maxWidth: 440,
          boxShadow: '0 20px 60px rgba(0,0,0,.2)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 22px 14px',
            borderBottom: `1px solid ${C.border}`,
            background: isDelete ? C.dangerBg : C.surface,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: isDelete ? C.danger : C.text }}>
            {meta.title}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
            {user.name} &middot; {user.email}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13, color: C.text, margin: 0, lineHeight: 1.5 }}>
            {meta.body(user.name)}
          </p>

          {meta.passwordNote && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                background: C.warnBg,
                border: `1px solid ${C.warnBorder}`,
                borderRadius: 8,
                padding: '10px 12px',
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>🔑</span>
              <span style={{ fontSize: 12, color: C.warn, fontWeight: 500 }}>
                {meta.passwordNote}
              </span>
            </div>
          )}

          {meta.irreversible && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                background: C.dangerBg,
                border: `1px solid ${C.dangerBorder}`,
                borderRadius: 8,
                padding: '10px 12px',
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>⚠️</span>
              <span style={{ fontSize: 12, color: C.danger, fontWeight: 600 }}>
                This action is irreversible and cannot be undone.
              </span>
            </div>
          )}

          {!meta.irreversible && !meta.passwordNote && (
            <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>
              This action can be reversed from the Actions menu.
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            padding: '14px 22px',
            borderTop: `1px solid ${C.border}`,
            background: C.surface,
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              border: `1.5px solid ${C.border}`,
              background: C.bg,
              color: C.muted,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = C.surface)}
            onMouseLeave={(e) => (e.currentTarget.style.background = C.bg)}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              border: 'none',
              background: meta.confirmColor,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            {meta.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shared sub-components ──────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const cfg =
    role === 'admin'
      ? {
          bg: C.adminBg,
          color: C.adminText,
          border: C.adminBorder,
          icon: <Shield size={11} />,
          label: 'Admin',
        }
      : role === 't-admin'
        ? {
            bg: C.tAdminBg,
            color: C.tAdminText,
            border: C.tAdminBorder,
            icon: <Shield size={11} />,
            label: 'T-Admin',
          }
        : role === 'moderator'
          ? {
              bg: C.modBg,
              color: C.modText,
              border: C.modBorder,
              icon: <Shield size={11} />,
              label: 'Moderator',
            }
          : role === 't-moderator'
            ? {
                bg: C.tModBg,
                color: C.tModText,
                border: C.tModBorder,
                icon: <GraduationCap size={11} />,
                label: 'T-Moderator',
              }
            : {
                bg: C.stuBg,
                color: C.stuText,
                border: C.stuBorder,
                icon: <GraduationCap size={11} />,
                label: 'Student',
              };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
        borderRadius: 20,
        padding: '3px 10px',
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function PageBtn({
  children,
  active,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 30,
        height: 30,
        borderRadius: 7,
        border: `1.5px solid ${active ? C.primary : C.border}`,
        background: active ? C.primary : C.bg,
        color: active ? '#fff' : disabled ? '#d1d5db' : C.muted,
        fontSize: 12,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}
