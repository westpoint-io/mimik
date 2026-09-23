export function StarredMascot() {
  return (
    <svg viewBox="0 0 200 200" className="w-24 h-24">
      <style>{`
        @keyframes twinkle{0%,100%{opacity:.4;transform:scale(.9)}50%{opacity:1;transform:scale(1.15)}}
      `}</style>
      <circle cx="100" cy="115" r="50" fill="#C7D2FE" />
      <rect x="58" y="115" width="84" height="40" rx="5" fill="#1E1B4B" />
      <path d="M58 115 L58 103 Q58 87 100 87 Q142 87 142 103 L142 115Z" fill="#3730A3" />
      <path d="M58 115 L58 103 Q58 87 100 87 Q142 87 142 103 L142 115Z" fill="#4F46E5" />
      <rect x="58" y="114" width="84" height="2" fill="#C7D2FE" />
      <path d="M82 131 Q88 124 94 131" stroke="#C7D2FE" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M106 131 Q112 124 118 131" stroke="#C7D2FE" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M92 143 Q100 150 108 143" stroke="#C7D2FE" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <g style={{ animation: 'twinkle 1.5s ease-in-out infinite' }}>
        <polygon
          points="155,70 159,80 170,81 162,88 164,99 155,93 146,99 148,88 140,81 151,80"
          fill="#FBBF24"
          stroke="#F59E0B"
          strokeWidth="1"
        />
      </g>
      <line x1="142" y1="120" x2="153" y2="90" stroke="#C7D2FE" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
