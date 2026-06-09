// Stub page for routes whose features land in later phases.
import { Layers } from 'lucide-react';

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 320,
        gap: 12,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 60,
          height: 60,
          background: 'var(--color-primary-bg)',
          borderRadius: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Layers size={26} color="var(--color-primary)" />
      </div>
      <div style={{ fontSize: 17, fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', maxWidth: 360 }}>
        Coming soon. This screen is part of an upcoming phase of the implementation roadmap.
      </div>
    </div>
  );
}
