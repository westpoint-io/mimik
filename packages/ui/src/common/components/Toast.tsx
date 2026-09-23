import { AlertCircle } from 'lucide-react';
import { useEffect } from 'react';

interface ToastProps {
  message: string | null;
  onDismiss: () => void;
  duration?: number;
}

export default function Toast({ message, onDismiss, duration = 5000 }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onDismiss]);

  if (!message) return null;

  return (
    <output
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 max-w-[90%] px-4 py-2.5 rounded-lg shadow-lg bg-primary text-primary-foreground text-[13px] font-medium"
      aria-live="polite"
    >
      <AlertCircle size={14} className="shrink-0" />
      {message}
    </output>
  );
}
