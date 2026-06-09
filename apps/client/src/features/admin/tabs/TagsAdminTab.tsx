// Inline tag management. Mirrors the Categories tab shape — small enough to keep parallel.
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { useDeleteTag, useCreateTag, useTags } from '../../faq/queries';

export function TagsAdminTab() {
  const { data, isLoading } = useTags();
  const [creating, setCreating] = useState(false);
  const [newTag, setNewTag] = useState('');
  const create = useCreateTag();
  const deleteTag = useDeleteTag();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newTag.trim().length < 2) return;
    await create.mutateAsync({ name: newTag.trim(), keywords: [] });
    setNewTag('');
    setCreating(false);
  };

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button onClick={() => setCreating((v) => !v)}>
          <Plus size={14} /> {creating ? 'Cancel' : 'New Tag'}
        </Button>
      </div>

      {/* Inline form — shown only when creating */}
      {creating && (
        <Card style={{ marginBottom: 12 }}>
          <form onSubmit={submit} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              autoFocus
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Tag name (e.g. noc, stipend)"
              minLength={2}
              maxLength={40}
              style={{
                flex: 1,
                background: 'var(--color-input)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                padding: '8px 10px',
                fontSize: 13,
                color: 'var(--color-text)',
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <Button type="submit" size="sm" disabled={create.isPending}>
              <Plus size={13} /> Add Tag
            </Button>
          </form>
          {create.error && (
            <div role="alert" style={{ marginTop: 8, fontSize: 12, color: 'var(--color-danger)' }}>
              {create.error instanceof Error ? create.error.message : 'Could not create tag'}
            </div>
          )}
        </Card>
      )}

      {isLoading && <Card>Loading…</Card>}

      {data && data.length > 0 && (
        <Card>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {data.map((tag) => (
              <div
                key={tag._id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--color-input)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  padding: '6px 10px',
                }}
              >
                <span style={{ fontSize: 13, color: 'var(--color-primary-text)', fontWeight: 500 }}>
                  #{tag.name}
                </span>
                <button
                  onClick={() => deleteTag.mutate(tag._id)}
                  aria-label={`Delete tag ${tag.name}`}
                  disabled={deleteTag.isPending}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-text-muted)',
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
