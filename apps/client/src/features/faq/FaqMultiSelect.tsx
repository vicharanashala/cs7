// Multi-select dropdown for FAQ category/tag filters.
// Stays open while selecting; closes on outside click or Escape. Passes selected IDs to the
// parent for the server query. Shared by the full Browse FAQs page and the login-page
// curated-FAQs modal so the filter looks and behaves identically in both.
import { useEffect, useRef } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { useExclusiveOpen } from '../../hooks/useExclusiveOpen';

const ITEM_H = 36;
const VISIBLE = 5;
const MAX_H = ITEM_H * VISIBLE + 8;

export function FaqMultiSelect({
  dropdownKey,
  values,
  onChange,
  placeholder,
  countLabel,
  options,
  width,
}: {
  dropdownKey: string;
  values: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
  countLabel: string;
  options: { value: string; label: string }[];
  width?: number;
}) {
  const { isOpen: open, toggle, close } = useExclusiveOpen(dropdownKey);
  const ref = useRef<HTMLDivElement>(null);
  const isActive = values.length > 0;

  const triggerLabel =
    values.length === 0
      ? placeholder
      : values.length === 1
        ? (options.find((o) => o.value === values[0])?.label ?? placeholder)
        : `${values.length} ${countLabel}`;

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, close]);

  const toggleOption = (id: string) =>
    onChange(values.includes(id) ? values.filter((v) => v !== id) : [...values, id]);

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0, minWidth: width ?? 130 }}>
      {/* ── Trigger ─────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${placeholder} filter — ${values.length} selected`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          height: 36,
          padding: '0 10px',
          borderRadius: 8,
          border: `1.5px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
          background: isActive ? 'var(--color-purple-bg)' : 'var(--color-input)',
          color: isActive ? 'var(--color-purple)' : 'var(--color-text)',
          fontSize: 13,
          fontWeight: isActive ? 600 : 400,
          cursor: 'pointer',
          fontFamily: 'inherit',
          gap: 6,
          outline: 'none',
          transition: 'border-color 0.15s, background 0.15s',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          if (!isActive)
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-primary)';
        }}
        onMouseLeave={(e) => {
          if (!isActive)
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)';
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, textAlign: 'left' }}>
          {triggerLabel}
        </span>
        {/* Count badge when 2+ selected */}
        {values.length > 1 && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              lineHeight: 1,
              padding: '2px 5px',
              borderRadius: 10,
              background: 'var(--color-purple)',
              color: 'white',
              flexShrink: 0,
            }}
          >
            {values.length}
          </span>
        )}
        <ChevronDown
          size={13}
          style={{
            flexShrink: 0,
            transition: 'transform 0.18s',
            transform: open ? 'rotate(180deg)' : 'none',
          }}
          color="var(--color-text-muted)"
        />
      </button>

      {/* ── Dropdown panel ──────────────────────────────────────── */}
      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            minWidth: '100%',
            zIndex: 1200,
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
            maxHeight: MAX_H,
            overflowY: 'auto',
            padding: '4px 0',
          }}
        >
          {/* Clear selection row — only shown when something is selected */}
          {isActive && (
            <div
              role="option"
              aria-selected={false}
              tabIndex={0}
              onClick={() => onChange([])}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onChange([]);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '0 14px',
                height: ITEM_H,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--color-danger)',
                borderBottom: '1px solid var(--color-border)',
                outline: 'none',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--color-danger-bg)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <X size={12} />
              Clear selection
            </div>
          )}

          {options.map((o) => {
            const selected = values.includes(o.value);
            return (
              <MultiDropdownOption
                key={o.value}
                label={o.label}
                selected={selected}
                onToggle={() => toggleOption(o.value)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function MultiDropdownOption({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      role="option"
      aria-selected={selected}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 14px',
        height: ITEM_H,
        cursor: 'pointer',
        background: selected ? 'var(--color-purple-bg)' : 'transparent',
        fontSize: 13,
        fontWeight: selected ? 600 : 400,
        color: selected ? 'var(--color-purple)' : 'var(--color-text)',
        outline: 'none',
        transition: 'background 0.1s',
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => {
        if (!selected) (e.currentTarget as HTMLElement).style.background = 'var(--color-input)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = selected
          ? 'var(--color-purple-bg)'
          : 'transparent';
      }}
    >
      {/* Checkbox indicator */}
      <span
        style={{
          width: 15,
          height: 15,
          borderRadius: 4,
          border: `1.5px solid ${selected ? 'var(--color-purple)' : 'var(--color-border)'}`,
          background: selected ? 'var(--color-purple)' : 'transparent',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'background 0.12s, border-color 0.12s',
        }}
      >
        {selected && <Check size={9} color="white" strokeWidth={3} />}
      </span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
    </div>
  );
}
