export function CoolMascot() {
  return (
    <svg width="120" height="100" viewBox="20 50 160 120" className="mb-6">
      <rect x="30" y="95" width="140" height="68" rx="8" fill="#1E1B4B" />
      <path d="M30 95 L30 80 Q30 58, 100 58 Q170 58, 170 80 L170 95 Z" fill="#3730A3" />
      <rect x="30" y="93" width="140" height="3" fill="#C7D2FE" />
      <rect x="60" y="112" width="28" height="16" rx="4" fill="#0F0E2A" stroke="#C7D2FE" strokeWidth="2" />
      <rect x="112" y="112" width="28" height="16" rx="4" fill="#0F0E2A" stroke="#C7D2FE" strokeWidth="2" />
      <line x1="88" y1="120" x2="112" y2="120" stroke="#C7D2FE" strokeWidth="2" />
      <path d="M88 140 Q100 148 116 142" stroke="#C7D2FE" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="50" cy="68" r="4" fill="#4F46E5" />
      <circle cx="150" cy="68" r="4" fill="#4F46E5" />
    </svg>
  );
}
