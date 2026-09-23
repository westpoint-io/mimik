export function NoGuidesMascot() {
  return (
    <svg viewBox="0 0 200 200" className="w-24 h-24 animate-[float_3s_ease-in-out_infinite]">
      <style>{`
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @keyframes sparkle{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.1)}}
      `}</style>
      <circle cx="45" cy="80" r="3" fill="#818CF8" style={{ animation: 'sparkle 1.5s ease-in-out infinite' }} />
      <circle cx="160" cy="70" r="2.5" fill="#818CF8" style={{ animation: 'sparkle 1.5s ease-in-out infinite 0.3s' }} />
      <circle cx="50" cy="140" r="2" fill="#A5B4FC" style={{ animation: 'sparkle 1.5s ease-in-out infinite 0.6s' }} />
      <circle
        cx="155"
        cy="145"
        r="2.5"
        fill="#818CF8"
        style={{ animation: 'sparkle 1.5s ease-in-out infinite 0.9s' }}
      />
      <circle cx="100" cy="110" r="50" fill="#C7D2FE" />
      <rect x="58" y="110" width="84" height="40" rx="5" fill="#1E1B4B" />
      <path d="M58 110 L58 98 Q58 82 100 82 Q142 82 142 98 L142 110Z" fill="#3730A3" />
      <path d="M58 110 L58 98 Q58 82 100 82 Q142 82 142 98 L142 110Z" fill="#4F46E5" />
      <rect x="58" y="109" width="84" height="2" fill="#C7D2FE" />
      <path d="M82 126 Q88 118 94 126" stroke="#C7D2FE" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M106 126 Q112 118 118 126" stroke="#C7D2FE" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M90 138 Q100 146 110 138" stroke="#C7D2FE" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}
