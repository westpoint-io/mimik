import {
  type CustomPrompts,
  defaultPrompt,
  exampleBlocks,
  MAX_INSTRUCTIONS_LENGTH,
  type PromptSection,
} from '@mimik/core/capture/ai/custom-prompts';
import { AI_LANGUAGES, type AILanguageCode } from '@mimik/core/capture/ai/prompts';
import { i18n } from '@mimik/core/env';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useAiPromptsDraft } from '../hooks/use-ai-prompts-draft';
import { PromptEditor } from './PromptEditor';

interface AiPromptsDialogProps {
  open: boolean;
  section: PromptSection;
  onSectionChange: (section: PromptSection) => void;
  onClose: () => void;
  onSaved: (prompts: CustomPrompts, changedLanguage: AILanguageCode | null) => void;
}

export function AiPromptsDialog({ open, section, onSectionChange, onClose, onSaved }: AiPromptsDialogProps) {
  const draft = useAiPromptsDraft({ open, onSaved });
  const current = draft.drafts[section];
  const languageLabel = AI_LANGUAGES.find((item) => item.code === draft.draftLanguage)?.label ?? '';
  const tabs: { id: PromptSection; label: string }[] = [
    { id: 'steps', label: i18n.t('settings.aiForSteps') },
    { id: 'guide', label: i18n.t('settings.aiForGuide') },
  ];

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[880px]">
        <DialogHeader>
          <DialogTitle>{i18n.t('settings.aiPromptsTitle')}</DialogTitle>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <DialogDescription>{i18n.t('settings.aiPromptsHint')}</DialogDescription>
            <div className="flex items-center gap-2">
              <span id="ai-prompts-language" className="text-[11px] font-semibold text-foreground">
                {i18n.t('settings.aiLanguage')}
              </span>
              <Select
                disabled={!draft.loaded}
                value={draft.draftLanguage}
                onValueChange={(v) => draft.changeLanguage(v as AILanguageCode)}
              >
                <SelectTrigger className="h-8 w-44" aria-labelledby="ai-prompts-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AI_LANGUAGES.map((item) => (
                    <SelectItem key={item.code} value={item.code}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={section} onValueChange={(next) => onSectionChange(next as PromptSection)}>
          <TabsList>
            {tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={section} className="mt-4">
            <div className="space-y-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <label htmlFor="ai-prompt" className="text-[11px] font-semibold text-foreground">
                    {i18n.t('settings.aiPromptLabel')}
                  </label>
                  <div className="flex items-center gap-2.5">
                    {draft.loaded && (
                      <span className="text-[11px] text-muted-foreground">
                        {i18n.t(
                          current.prompt === defaultPrompt(section, draft.draftLanguage)
                            ? 'settings.aiPromptDefault'
                            : 'settings.aiPromptEdited',
                        )}
                      </span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 shrink-0 rounded-lg text-[11px]"
                      disabled={!draft.loaded}
                      onClick={() => draft.resetPrompt(section)}
                    >
                      {i18n.t('settings.aiPromptReset')}
                    </Button>
                  </div>
                </div>
                <PromptEditor
                  id="ai-prompt"
                  value={current.prompt}
                  blocks={exampleBlocks(section, draft.draftLanguage)}
                  flash={draft.flash}
                  disabled={!draft.loaded}
                  onChange={(value) => draft.editPrompt(section, value)}
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <label htmlFor="ai-instructions" className="text-[11px] font-semibold text-foreground">
                    {i18n.t('settings.aiInstructionsLabel')}{' '}
                    <span className="font-normal text-muted-foreground">({i18n.t('settings.optional')})</span>
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    {current.instructions.length} / {MAX_INSTRUCTIONS_LENGTH}
                  </span>
                </div>
                <textarea
                  id="ai-instructions"
                  rows={3}
                  disabled={!draft.loaded}
                  maxLength={MAX_INSTRUCTIONS_LENGTH}
                  value={current.instructions}
                  placeholder={i18n.t('settings.aiInstructionsPlaceholder')}
                  onChange={(event) => draft.editInstructions(section, event.target.value)}
                  className="block w-full resize-y rounded-lg border border-border bg-card px-3 py-2.5 text-[13px] leading-relaxed text-foreground"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <span role="status" className="sr-only">
          {draft.switched ? i18n.t('settings.aiExamplesSwitched', [languageLabel]) : ''}
        </span>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            {i18n.t('common.cancel')}
          </Button>
          <Button size="sm" disabled={!draft.canSave} onClick={() => void draft.save()}>
            {i18n.t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
