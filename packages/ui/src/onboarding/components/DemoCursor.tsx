export function DemoCursor({ className = '' }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`pointer-events-none absolute z-[3] ${className}`}
    >
      <path
        d="M4.04 4.86 10.7 21.2a.5.5 0 0 0 .93-.03l2.4-6.95 6.95-2.4a.5.5 0 0 0 .03-.93L4.86 4.04a.5.5 0 0 0-.82.82Z"
        fill="#fff"
        stroke="#1E1B4B"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
