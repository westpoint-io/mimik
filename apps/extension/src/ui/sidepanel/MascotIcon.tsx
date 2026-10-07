export function MascotIcon({ size = 44 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width={size} height={size}>
      <defs>
        <clipPath id="cc">
          <circle cx="100" cy="100" r="95" />
        </clipPath>
        <clipPath id="ds">
          <path d="M30 95 L170 60 L170 95 Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#cc)">
        <rect x="-50" y="-50" width="300" height="300" className="fill-lavender" />
        <rect
          x="30"
          y="-80"
          width="50"
          height="400"
          className="fill-accent"
          transform="rotate(45, 100, 100)"
          opacity="0.15"
        />
        <rect x="90" y="-80" width="50" height="400" fill="#818CF8" transform="rotate(45, 100, 100)" opacity="0.12" />
        <rect x="-30" y="-80" width="50" height="400" fill="#93C5FD" transform="rotate(45, 100, 100)" opacity="0.15" />
        <rect x="150" y="-80" width="50" height="400" fill="#A5B4FC" transform="rotate(45, 100, 100)" opacity="0.1" />
      </g>
      <rect x="30" y="95" width="140" height="68" rx="5" className="fill-primary" />
      <path d="M30 95 L30 80 Q30 60, 100 60 Q170 60, 170 80 L170 95 Z" className="fill-violet-mid" />
      <path d="M30 95 L30 80 Q30 60, 100 60 Q170 60, 170 80 L170 95 Z" className="fill-accent" clipPath="url(#ds)" />
      <rect x="30" y="93" width="140" height="3" className="fill-lavender" />
      <path d="M68 122 Q76 112 84 122" className="stroke-lavender" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path
        d="M116 122 Q124 112 132 122"
        className="stroke-lavender"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M84 138 Q100 148 116 138"
        className="stroke-lavender"
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
