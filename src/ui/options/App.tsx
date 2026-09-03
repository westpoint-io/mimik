import { useDisplayLocale } from '@/lib/use-display-locale';
import SettingsView from '@/ui/shared/SettingsView';

export default function App() {
  useDisplayLocale();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        width: '100%',
        background: 'radial-gradient(ellipse at center, #fafafc 0%, #f0f2fa 60%, #e5e8f4 100%)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '28rem',
          background: 'white',
          borderRadius: '16px',
          border: '1px solid var(--color-border)',
          boxShadow: '0 8px 40px rgba(30,27,75,0.08)',
          overflow: 'hidden',
        }}
      >
        <SettingsView />
      </div>
    </div>
  );
}
