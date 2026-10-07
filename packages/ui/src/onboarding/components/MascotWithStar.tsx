export function MascotWithStar({ size = 300 }: { size?: number }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size}>
      <circle cx="34" cy="96" r="4" fill="#818CF8" style={{ animation: 'sparkle 1.5s ease-in-out infinite' }} />
      <circle cx="168" cy="86" r="3.5" fill="#818CF8" style={{ animation: 'sparkle 1.5s ease-in-out infinite 0.5s' }} />
      <circle cx="46" cy="30" r="3" fill="#A5B4FC" style={{ animation: 'sparkle 1.5s ease-in-out infinite 0.9s' }} />
      <g transform="translate(72 2) scale(2.333)">
        <path
          d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z"
          fill="#FACC15"
        />
      </g>
      <circle cx="100" cy="110" r="55" fill="#C7D2FE" />
      <rect x="55" y="110" width="90" height="44" rx="5" fill="#1E1B4B" />
      <path d="M55 110 L55 98 Q55 80 100 80 Q145 80 145 98 L145 110Z" fill="#4F46E5" />
      <rect x="55" y="109" width="90" height="2" fill="#C7D2FE" />
      <path d="M80 128 Q86 120 92 128" stroke="#C7D2FE" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M108 128 Q114 120 120 128" stroke="#C7D2FE" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M90 140 Q100 149 110 140" stroke="#C7D2FE" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}
