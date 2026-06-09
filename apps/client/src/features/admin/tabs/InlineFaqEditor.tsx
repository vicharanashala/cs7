// Compact in-table editor for FAQs. Renders a card-shaped form so it slots into the
// FAQ Management table without launching a modal.
import { useState, useRef, useEffect } from 'react';
import { useExclusiveOpen } from '../../../hooks/useExclusiveOpen';
import { X, ThumbsUp, ThumbsDown, Flag, RotateCcw } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  faqCreateSchema,
  faqUpdateSchema,
  type FaqCreateInput,
  type FaqUpdateInput,
  type FaqStatus,
} from '@samagama/shared';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { useCreateFaq, useUpdateFaq } from '../../faq/queries';

interface ExistingFaq {
  id: string;
  title: string;
  answer: string;
  summary?: string;
  status: FaqStatus;
  categories: string[];
  tags: string[];
  helpfulCount?: number;
  unhelpfulCount?: number;
  flagCount?: number;
}

interface Props {
  categories: { _id: string; name: string }[];
  tags: { _id: string; name: string }[];
  existing?: ExistingFaq;
  onClose: () => void;
}

export function InlineFaqEditor({ categories, tags, existing, onClose }: Props) {
  const isEdit = !!existing;
  const createMutation = useCreateFaq();
  const updateMutation = useUpdateFaq();
  const [statsResetNote, setStatsResetNote] = useState(false);
  const [resetHelpful, setResetHelpful] = useState(false);
  const [resetUnhelpful, setResetUnhelpful] = useState(false);
  const [resetFlags, setResetFlags] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
  } = useForm<FaqCreateInput>({
    resolver: zodResolver(isEdit ? faqUpdateSchema : faqCreateSchema),
    defaultValues: existing
      ? {
          title: existing.title,
          answer: existing.answer,
          summary: existing.summary,
          status: existing.status,
          categories: existing.categories,
          tags: existing.tags,
        }
      : { status: 'draft', categories: [], tags: [] },
  });

  const selectedCategories = watch('categories') ?? [];
  const selectedTags = watch('tags') ?? [];

  const onSubmit = handleSubmit(async (values) => {
    if (isEdit && existing) {
      const updateInput: FaqUpdateInput = {
        ...values,
        ...(resetHelpful ? { resetHelpful: true } : {}),
        ...(resetUnhelpful ? { resetUnhelpful: true } : {}),
        ...(resetFlags ? { resetFlags: true } : {}),
      };
      const result = await updateMutation.mutateAsync({ id: existing.id, input: updateInput });
      if (result.statsReset) setStatsResetNote(true);
      else onClose();
    } else {
      await createMutation.mutateAsync(values);
      onClose();
    }
  });

  const error = createMutation.error ?? updateMutation.error;

  return (
    <Card>
      <form onSubmit={onSubmit}>
        <Field label="Question *" error={errors.title?.message}>
          <input
            {...register('title')}
            placeholder="What's the question students will ask?"
            style={inputStyle}
          />
        </Field>

        <Field label="Answer *" error={errors.answer?.message}>
          <textarea
            {...register('answer')}
            rows={5}
            placeholder="Be specific. Include any links to official sources."
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </Field>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 14,
            marginBottom: 14,
          }}
        >
          <Field label="Categories *" error={errors.categories?.message}>
            <SearchableMultiSelect
              dropdownKey="faq-editor-categories"
              options={categories.map((c) => ({ id: c._id, label: c.name }))}
              selected={selectedCategories}
              onChange={(ids) => setValue('categories', ids, { shouldValidate: true })}
              placeholder="Search categories…"
            />
          </Field>

          <Field label="Tags">
            <SearchableMultiSelect
              dropdownKey="faq-editor-tags"
              options={tags.map((t) => ({ id: t._id, label: `#${t.name}` }))}
              selected={selectedTags}
              onChange={(ids) => setValue('tags', ids, { shouldValidate: true })}
              placeholder={tags.length === 0 ? 'No tags yet' : 'Search tags…'}
              disabled={tags.length === 0}
            />
          </Field>

          <Field label="Status">
            <select {...register('status')} style={inputStyle}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="outdated">Outdated</option>
            </select>
          </Field>
        </div>

        {/* Manual stat resets — edit mode only */}
        {isEdit && (
          <div
            style={{
              marginBottom: 14,
              padding: '12px 14px',
              background: 'var(--color-input)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '.5px',
                marginBottom: 10,
              }}
            >
              Reset counters
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <CounterCard
                icon={<ThumbsUp size={14} strokeWidth={1.8} />}
                label="Helpful"
                count={existing?.helpfulCount ?? 0}
                active={resetHelpful}
                onToggle={() => setResetHelpful((v) => !v)}
                color="var(--color-success)"
                bgColor="var(--color-success-bg)"
              />
              <CounterCard
                icon={<ThumbsDown size={14} strokeWidth={1.8} />}
                label="Not Helpful"
                count={existing?.unhelpfulCount ?? 0}
                active={resetUnhelpful}
                onToggle={() => setResetUnhelpful((v) => !v)}
                color="var(--color-danger)"
                bgColor="var(--color-danger-bg)"
              />
              <CounterCard
                icon={<Flag size={14} strokeWidth={1.8} />}
                label="Flagged"
                count={existing?.flagCount ?? 0}
                active={resetFlags}
                onToggle={() => setResetFlags((v) => !v)}
                color="var(--color-warning)"
                bgColor="var(--color-warning-bg)"
              />
            </div>
          </div>
        )}

        {statsResetNote && (
          <div
            role="status"
            style={{
              background: 'var(--color-warning-bg)',
              color: 'var(--color-warning)',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 12,
              marginBottom: 10,
            }}
          >
            The answer changed, so helpful/flagged stats were reset to zero. Outstanding flags were
            marked resolved.
          </div>
        )}

        {error && (
          <div
            role="alert"
            style={{
              background: 'var(--color-danger-bg)',
              color: 'var(--color-danger)',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 13,
              marginBottom: 10,
            }}
          >
            {error instanceof Error ? error.message : 'Could not save FAQ'}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="submit" disabled={isSubmitting}>
            {isEdit ? 'Save changes' : 'Create FAQ'}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            {statsResetNote ? 'Done' : 'Cancel'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
        {label}
      </label>
      {children}
      {error && (
        <div style={{ fontSize: 12, color: 'var(--color-danger)', marginTop: 4 }}>{error}</div>
      )}
    </div>
  );
}

function SearchableMultiSelect({
  dropdownKey,
  options,
  selected,
  onChange,
  placeholder = 'Search…',
  disabled = false,
}: {
  dropdownKey: string;
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState('');
  const { isOpen: open, open: openDropdown, close } = useExclusiveOpen(dropdownKey);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, close]);

  const filtered = options.filter(
    (o) => o.label.toLowerCase().includes(search.toLowerCase()) && !selected.includes(o.id),
  );

  const selectedOptions = options.filter((o) => selected.includes(o.id));

  const add = (id: string) => {
    onChange([...selected, id]);
    setSearch('');
  };
  const remove = (id: string) => onChange(selected.filter((s) => s !== id));

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Input box with selected chips + search field */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 5,
          padding: '6px 10px',
          background: 'var(--color-input)',
          border: `1px solid ${open ? 'var(--color-primary)' : 'var(--color-border)'}`,
          borderRadius: 8,
          minHeight: 42,
          alignItems: 'center',
          cursor: disabled ? 'not-allowed' : 'text',
          transition: 'border-color .15s',
          boxSizing: 'border-box',
        }}
        onClick={() => !disabled && openDropdown()}
      >
        {selectedOptions.map((o) => (
          <span
            key={o.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              background: 'var(--color-primary)',
              color: '#fff',
              borderRadius: 20,
              padding: '2px 6px 2px 10px',
              fontSize: 12,
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}
          >
            {o.label}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(o.id);
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                color: 'rgba(255,255,255,0.75)',
                lineHeight: 1,
              }}
            >
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => !disabled && openDropdown()}
          placeholder={selectedOptions.length === 0 ? placeholder : ''}
          disabled={disabled}
          style={{
            border: 'none',
            outline: 'none',
            background: 'none',
            color: 'var(--color-text)',
            fontSize: 13,
            fontFamily: 'inherit',
            flex: '1 1 80px',
            minWidth: 60,
            padding: '2px 0',
            cursor: disabled ? 'not-allowed' : 'text',
          }}
        />
      </div>

      {/* Dropdown */}
      {open && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            zIndex: 50,
            maxHeight: 200,
            overflowY: 'auto',
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--color-text-muted)' }}>
              {search ? `No results for "${search}"` : 'All options selected'}
            </div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => add(o.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '9px 14px',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: 'var(--color-text)',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = 'var(--color-sidebar-hover)')
                }
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                {o.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--color-input)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  padding: '10px 12px',
  color: 'var(--color-text)',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};

function CounterCard({
  icon,
  label,
  count,
  active,
  onToggle,
  color,
  bgColor,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  onToggle: () => void;
  color: string;
  bgColor: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        background: active ? bgColor : 'var(--color-card)',
        border: `1.5px solid ${active ? color : 'var(--color-border)'}`,
        borderRadius: 10,
        transition: 'border-color .15s, background .15s',
      }}
    >
      <div style={{ color, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1.1 }}>{count}</div>
        <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 500 }}>{label}</div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        title={active ? 'Undo reset' : `Reset ${label}`}
        style={{
          width: 28,
          height: 28,
          borderRadius: 7,
          border: `1px solid ${active ? color : 'var(--color-border)'}`,
          background: active ? color : 'var(--color-input)',
          color: active ? '#fff' : 'var(--color-text-muted)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all .15s',
        }}
      >
        <RotateCcw size={12} strokeWidth={2} />
      </button>
    </div>
  );
}

