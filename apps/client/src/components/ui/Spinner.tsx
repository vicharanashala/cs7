// Inline loading spinner built on the shared `spin` keyframes in globals.css.
// Use for in-context async states (e.g. "checking…"); for whole-section loads
// prefer <SkeletonList>, and for buttons use <Button loading>.
interface SpinnerProps {
  /** Diameter in px. Default 16. */
  size?: number;
  /** Stroke colour. Defaults to currentColor so it inherits text colour. */
  color?: string;
  /** Accessible label; defaults to "Loading". */
  label?: string;
}

export function Spinner({ size = 16, color = 'currentColor', label = 'Loading' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: `2px solid ${color}`,
        borderRightColor: 'transparent',
        borderRadius: '50%',
        opacity: 0.85,
        animation: 'spin 0.6s linear infinite',
        verticalAlign: 'middle',
      }}
    />
  );
}
