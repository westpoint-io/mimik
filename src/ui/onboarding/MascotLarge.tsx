export function MascotLarge({ size = 280 }: { size?: number }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size}>
      <circle cx="40" cy="70" r="4" fill="#818CF8" style={{ animation: 'sparkle 1.5s ease-in-out infinite' }} />
      <circle cx="165" cy="60" r="3.5" fill="#818CF8" style={{ animation: 'sparkle 1.5s ease-in-out infinite 0.3s' }} />
      <circle cx="42" cy="155" r="3" fill="#A5B4FC" style={{ animation: 'sparkle 1.5s ease-in-out infinite 0.6s' }} />
      <circle
        cx="162"
        cy="150"
        r="3.5"
        fill="#818CF8"
        style={{ animation: 'sparkle 1.5s ease-in-out infinite 0.9s' }}
      />
      <circle cx="100" cy="110" r="55" fill="#C7D2FE" />
      <rect x="55" y="110" width="90" height="44" rx="5" fill="#1E1B4B" />
      <path d="M55 110 L55 98 Q55 80 100 80 Q145 80 145 98 L145 110Z" fill="#3730A3" />
      <path d="M55 110 L55 98 Q55 80 100 80 Q145 80 145 98 L145 110Z" fill="#4F46E5" />
      <rect x="55" y="109" width="90" height="2" fill="#C7D2FE" />
      <path d="M80 128 Q86 120 92 128" stroke="#C7D2FE" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M108 128 Q114 120 120 128" stroke="#C7D2FE" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M90 140 Q100 148 110 140" stroke="#C7D2FE" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <style>{`@keyframes sparkle{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.1)}}@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}`}</style>
    </svg>
  );
}
