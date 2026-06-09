// Admin Settings — configurable thresholds for the portal.
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import type { ApiSuccess } from '@samagama/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { apiClient } from '../../lib/api-client';
import { useSettings, type PublicSettings } from '../../hooks/useSettings';

export function SettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useSettings();

  const [form, setForm] = useState<PublicSettings>({
    chatbotConfidenceThreshold: 0.7,
    chatbotMaxSources: 6,
    communityAnswerCap: 10,
    urgentIdleDays: 7,
  });

  // Auto-dismiss success banner after 3 s
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: async (input: Partial<PublicSettings>) => {
      const res = await apiClient.patch<ApiSuccess<PublicSettings>>('/api/settings', input);
      return res.data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['settings'] });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    },
  });

  const handleSave = () => save.mutate(form);

  if (isLoading) {
    return (
      <div>
        <SectionHeader title="Settings" sub="System-wide configuration." />
        <Card>Loading…</Card>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title="Settings"
        sub="Configurable thresholds and defaults for the portal."
        action={
          <Button onClick={handleSave} disabled={save.isPending}>
            <Save size={14} /> {save.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        }
      />

      {showSuccess && (
        <div
          style={{
            marginBottom: 16,
            padding: '10px 16px',
            borderRadius: 8,
            background: 'var(--color-success-bg)',
            color: 'var(--color-success)',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          ✓ Settings saved successfully.
        </div>
      )}

      {save.isError && (
        <div
          style={{
            marginBottom: 16,
            padding: '10px 16px',
            borderRadius: 8,
            background: 'var(--color-danger-bg)',
            color: 'var(--color-danger)',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          Failed to save settings — please try again.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Chatbot */}
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Chatbot</div>
          <SettingField
            label="Confidence Threshold"
            description="Minimum similarity score for a chatbot FAQ source to be included in the response."
            value={form.chatbotConfidenceThreshold}
            onChange={(v) => setForm((f) => ({ ...f, chatbotConfidenceThreshold: v }))}
            min={0}
            max={1}
            step={0.05}
          />
          <SettingField
            label="Max Sources"
            description="Maximum number of FAQ sources shown per chatbot response."
            value={form.chatbotMaxSources}
            onChange={(v) => setForm((f) => ({ ...f, chatbotMaxSources: v }))}
            min={1}
            max={20}
            step={1}
            isInt
          />
        </Card>

        {/* Community Q&A */}
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Community Q&A</div>
          <SettingField
            label="Answer Cap"
            description="Maximum peer answers allowed per community question."
            value={form.communityAnswerCap}
            onChange={(v) => setForm((f) => ({ ...f, communityAnswerCap: v }))}
            min={1}
            max={50}
            step={1}
            isInt
          />
        </Card>

        {/* Moderation */}
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Moderation</div>
          <SettingField
            label="Urgent Idle Days"
            description="Questions with no activity for this many days are placed in the urgent moderation bucket."
            value={form.urgentIdleDays}
            onChange={(v) => setForm((f) => ({ ...f, urgentIdleDays: v }))}
            min={1}
            max={30}
            step={1}
            isInt
          />
        </Card>
      </div>
    </div>
  );
}

function SettingField({
  label,
  description,
  value,
  onChange,
  min,
  max,
  step,
  isInt,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  isInt?: boolean;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 2 }}>
        {label}
      </label>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6 }}>
        {description}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) =>
            onChange(isInt ? parseInt(e.target.value, 10) : parseFloat(e.target.value))
          }
          style={{ flex: 1, accentColor: 'var(--color-primary)' }}
        />
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--color-primary)',
            minWidth: 36,
            textAlign: 'right',
          }}
        >
          {isInt ? value : value.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
