import { i18n } from '@mimik/core/env';

const hints = [
  { key: '↑↓', labelKey: 'keyboard_navigate' as const },
  { key: '↵', labelKey: 'keyboard_open' as const },
  { key: 'esc', labelKey: 'keyboard_close' as const },
];

export default function KeyboardHints() {
  return (
    <div className="flex items-center gap-3 px-4 py-2 border-t border-border">
      {hints.map((h) => (
        <span key={h.key} className="contents">
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-lavender text-foreground">{h.key}</span>
          <span className="text-[10px] text-purple">{i18n.t(h.labelKey)}</span>
        </span>
      ))}
    </div>
  );
}
