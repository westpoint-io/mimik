import type { CustomPrompts, PromptSection } from '@mimik/core/capture/ai/custom-prompts';
import type { AILanguageCode } from '@mimik/core/capture/ai/prompts';
import { i18n, localStorage } from '@mimik/core/env';
import { useEffect, useState } from 'react';
import { ConfirmDialog } from '../../common/components/ConfirmDialog';
import { Button } from '../../components/ui/button';
import { AiPromptsDialog } from './AiPromptsDialog';

interface AiPromptsRowProps {
  onLanguageChange: (language: AILanguageCode) => void;
  onEditPrompts?: (section: PromptSection) => void;
  onChange?: (patch: Record<string, unknown>) => void;
  promptsRequest?: PromptSection | null;
  onPromptsRequestHandled?: () => void;
}

export function AiPromptsRow({
  onLanguageChange,
  onEditPrompts,
  onChange,
  promptsRequest,
  onPromptsRequestHandled,
}: AiPromptsRowProps) {
  const [open, setOpen] = useState(false);
  const [editSection, setEditSection] = useState<PromptSection>('steps');
  const [prompts, setPrompts] = useState<CustomPrompts>({});
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetSection, setResetSection] = useState<PromptSection>('steps');

  useEffect(() => {
    const load = () => localStorage.get(['aiPrompts']).then(({ aiPrompts }) => setPrompts(aiPrompts ?? {}));
    void load();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);

  useEffect(() => {
    if (!promptsRequest) return;
    setEditSection(promptsRequest);
    setOpen(true);
    onPromptsRequestHandled?.();
  }, [promptsRequest, onPromptsRequestHandled]);

  const write = (next: CustomPrompts) => {
    setPrompts(next);
    void localStorage.set({ aiPrompts: next });
    onChange?.({ aiPrompts: next });
  };

  const sections: { id: PromptSection; label: string }[] = [
    { id: 'steps', label: i18n.t('settings.aiForSteps') },
    { id: 'guide', label: i18n.t('settings.aiForGuide') },
  ];

  return (
    <div className="space-y-2.5 border-t border-secondary pt-3">
      <div>
        <p className="text-xs font-semibold text-foreground">{i18n.t('settings.aiAdvanced')}</p>
        <p className="text-[11px] text-muted-foreground">{i18n.t('settings.aiAdvancedHint')}</p>
      </div>

      <div className="divide-y divide-border rounded-lg border border-border">
        {sections.map((section) => (
          <div key={section.id} className="flex items-center justify-between gap-2 px-2.5 py-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground">{section.label}</p>
              {prompts[section.id] ? (
                <p className="text-[11px] font-semibold text-foreground dark:text-violet">
                  {i18n.t('settings.aiCustomised')}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">{i18n.t('settings.aiPromptDefault')}</p>
              )}
            </div>
            <div className="flex shrink-0 gap-1.5">
              {prompts[section.id] && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-lg text-[11px]"
                  aria-label={`${i18n.t('settings.aiReset')}: ${section.label}`}
                  onClick={() => {
                    setResetSection(section.id);
                    setConfirmingReset(true);
                  }}
                >
                  {i18n.t('settings.aiReset')}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-7 rounded-lg text-[11px]"
                aria-label={`${i18n.t('editor.edit')}: ${section.label}`}
                onClick={() => {
                  if (onEditPrompts) {
                    onEditPrompts(section.id);
                    return;
                  }
                  setEditSection(section.id);
                  setOpen(true);
                }}
              >
                {i18n.t('editor.edit')}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={confirmingReset}
        heading={i18n.t('settings.aiResetConfirmTitle', [
          sections.find((section) => section.id === resetSection)?.label ?? '',
        ])}
        description={i18n.t('settings.aiResetConfirmMessage')}
        confirmLabel={i18n.t('settings.aiReset')}
        destructive
        onConfirm={async () => {
          setConfirmingReset(false);
          const { aiPrompts } = await localStorage.get(['aiPrompts']);
          write(Object.fromEntries(Object.entries(aiPrompts ?? {}).filter(([key]) => key !== resetSection)));
        }}
        onCancel={() => setConfirmingReset(false)}
      />

      {!onEditPrompts && (
        <AiPromptsDialog
          open={open}
          section={editSection}
          onSectionChange={setEditSection}
          onClose={() => setOpen(false)}
          onSaved={(next, changedLanguage) => {
            setPrompts(next);
            onChange?.({ aiPrompts: next });
            if (changedLanguage) onLanguageChange(changedLanguage);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
