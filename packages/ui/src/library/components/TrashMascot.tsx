export function TrashMascot() {
  return (
    <svg viewBox="0 0 200 200" className="w-24 h-24">
      <style>{`
        @keyframes sweep{0%,100%{transform:rotate(-10deg)}50%{transform:rotate(10deg)}}
        @keyframes sparkle{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.1)}}
      `}</style>
      <circle cx="100" cy="115" r="50" fill="#C7D2FE" />
      <rect x="58" y="115" width="84" height="40" rx="5" fill="#1E1B4B" />
      <path d="M58 115 L58 103 Q58 87 100 87 Q142 87 142 103 L142 115Z" fill="#3730A3" />
      <path d="M58 115 L58 103 Q58 87 100 87 Q142 87 142 103 L142 115Z" fill="#4F46E5" />
      <rect x="58" y="114" width="84" height="2" fill="#C7D2FE" />
      <path d="M82 131 Q88 124 94 131" stroke="#C7D2FE" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M106 131 Q112 124 118 131" stroke="#C7D2FE" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M92 143 Q100 150 108 143" stroke="#C7D2FE" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <g style={{ transformOrigin: '155px 130px', animation: 'sweep 1.5s ease-in-out infinite' }}>
        <line x1="155" y1="75" x2="155" y2="140" stroke="#A5B4FC" strokeWidth="3" strokeLinecap="round" />
        <path d="M147 140 Q155 135 163 140 L160 155 Q155 158 150 155Z" fill="#818CF8" />
      </g>
      <circle cx="165" cy="155" r="2" fill="#818CF8" style={{ animation: 'sparkle 1s ease-in-out infinite' }} />
      <circle cx="148" cy="160" r="1.5" fill="#818CF8" style={{ animation: 'sparkle 1s ease-in-out infinite 0.3s' }} />
    </svg>
  );
}
