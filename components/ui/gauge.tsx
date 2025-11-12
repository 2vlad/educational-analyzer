interface GaugeProps {
  value: number
  max: number
  'aria-label'?: string
}

export function Gauge({ value, max, 'aria-label': ariaLabel }: GaugeProps) {
  // Angle calculation: -90deg (0 из max) → +90deg (max из max)
  const angle = -90 + (value / max) * 180

  return (
    <div className="gauge grid place-items-center min-w-[43px]" aria-label={ariaLabel}>
      <svg
        className="w-11 h-7 block"
        viewBox="0 0 64 40"
        aria-hidden="true"
        style={{ overflow: 'visible' }}
      >
        {/* Track (background arc) */}
        <path
          d="M8,32 A24,24 0 0 1 56,32"
          stroke="#e9ece8"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
        />

        {/* Gradient definition */}
        <defs>
          <linearGradient id={`grad-${value}-${max}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f4bfb7" />
            <stop offset="50%" stopColor="#fce7ae" />
            <stop offset="100%" stopColor="#cfe8be" />
          </linearGradient>
        </defs>

        {/* Colored arc */}
        <path
          d="M8,32 A24,24 0 0 1 56,32"
          stroke={`url(#grad-${value}-${max})`}
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
        />

        {/* Center pivot */}
        <circle cx="32" cy="32" r="2" fill="#505650" />

        {/* Needle (arrow) */}
        <g
          style={{
            transformOrigin: '32px 32px',
            transform: `rotate(${angle}deg)`,
            transition: 'transform 0.3s ease',
          }}
        >
          <line
            x1="32"
            y1="32"
            x2="13"
            y2="33"
            stroke="#2b2f2b"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      </svg>

      {/* Value label */}
      <div className="text-xs mt-0.5 text-center font-semibold" aria-hidden="true">
        {value}/{max}
      </div>
    </div>
  )
}
