import { useRef } from 'react';
import { highlightSegments } from '../lib/highlight-segments';

interface PromptEditorProps {
  id: string;
  value: string;
  blocks: readonly string[];
  flash: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function PromptEditor({ id, value, blocks, flash, disabled = false, onChange }: PromptEditorProps) {
  const backdrop = useRef<HTMLDivElement>(null);
  const shared =
    'rounded-lg border px-3 py-2.5 font-mono text-xs leading-[1.65] whitespace-pre-wrap break-words [scrollbar-gutter:stable]';

  return (
    <div className="relative rounded-lg bg-card">
      <div
        ref={backdrop}
        aria-hidden="true"
        className={`${shared} pointer-events-none absolute inset-0 overflow-hidden border-transparent text-transparent`}
      >
        {highlightSegments(value, blocks).map((segment) => (
          <span
            key={segment.key}
            className={
              segment.marked
                ? `rounded-sm transition-colors duration-700 motion-reduce:transition-none ${flash ? 'bg-border dark:bg-violet/40' : 'bg-transparent'}`
                : undefined
            }
          >
            {segment.text}
          </span>
        ))}
        {'\n'}
      </div>
      <textarea
        id={id}
        rows={13}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onScroll={(event) => {
          if (backdrop.current) backdrop.current.scrollTop = event.currentTarget.scrollTop;
        }}
        className={`${shared} relative block w-full resize-none border-border bg-transparent text-foreground`}
      />
    </div>
  );
}
