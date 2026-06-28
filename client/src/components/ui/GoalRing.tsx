interface GoalRingProps {
  achieved: number;
  target: number;
  size?: number;
}

export function GoalRing({ achieved, target, size = 104 }: GoalRingProps) {
  const r = size * 0.385;
  const cx = size / 2;
  const circ = 2 * Math.PI * r;
  const pct = target > 0 ? Math.min(1, achieved / target) : 0;
  const offset = circ * (1 - pct);
  const sw = size * 0.077;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`${achieved} of ${target} books`}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--line)" strokeWidth={sw} />
      <circle
        cx={cx} cy={cx} r={r} fill="none"
        stroke="var(--gilt)" strokeWidth={sw}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cx})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
      <text x={cx} y={cx - 4} textAnchor="middle" fill="var(--parchment)"
        fontSize={size * 0.2} fontFamily="JetBrains Mono, monospace" fontWeight={500}>
        {achieved}
      </text>
      <text x={cx} y={cx + size * 0.14} textAnchor="middle" fill="var(--muted)"
        fontSize={size * 0.105} fontFamily="Hanken Grotesk, sans-serif">
        of {target}
      </text>
    </svg>
  );
}
