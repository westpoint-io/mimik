import { i18n } from '#imports';
import { SadMascot } from './SadMascot';

export function ExitConfirmation({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-card/80 backdrop-blur-[2px]">
      <div className="bg-card rounded-2xl border border-border shadow-lg p-6 w-[280px] text-center flex flex-col items-center">
        <SadMascot />
        <h3 className="text-[15px] font-bold text-foreground mt-3 mb-1">{i18n.t('guideme.exitTitle')}</h3>
        <p className="text-[12px] text-muted-foreground leading-relaxed mb-5">{i18n.t('guideme.exitMessage')}</p>
        <div className="flex gap-2.5 w-full">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg font-semibold text-sm bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
          >
            {i18n.t('guideme.stay')}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-lg font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {i18n.t('guideme.exit')}
          </button>
        </div>
      </div>
    </div>
  );
}
