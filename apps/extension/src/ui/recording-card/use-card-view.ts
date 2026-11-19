import type { CardShortcuts, CardView } from '@mimik/core/capture/card-view';
import { useEffect, useState } from 'react';
import { browser } from '#imports';
import type { AiFailureUpdate } from '@/core/capture/ai/errors';
import { connectToBackground } from '@/lib/port/connect-to-background';
import { CARD_PORT_NAME } from '@/lib/port/constants';
import type { PanelCardUpdate, PanelStateUpdate, PanelVoiceUpdate } from '@/lib/port/types';

const IDLE: PanelCardUpdate = {
  type: 'CARD_UPDATE',
  step: null,
  busy: false,
  progress: { percent: 0, ms: 0 },
  print: { src: null, aim: null },
};

export function useCardView(): CardView | null {
  const [update, setUpdate] = useState<PanelStateUpdate | null>(null);
  const [voice, setVoice] = useState<PanelVoiceUpdate | null>(null);
  const [aiFailure, setAiFailure] = useState<AiFailureUpdate | null>(null);
  const [card, setCard] = useState<PanelCardUpdate>(IDLE);
  const [shortcuts, setShortcuts] = useState<CardShortcuts>({ record: null, capture: null });

  useEffect(
    () =>
      connectToBackground(
        {
          onConnect: () => undefined,
          onDisconnect: () => undefined,
          onStateUpdate: setUpdate,
          onVoiceUpdate: setVoice,
          onAiUpdate: setAiFailure,
          onCardUpdate: setCard,
        },
        CARD_PORT_NAME,
      ),
    [],
  );

  useEffect(() => {
    void browser.commands.getAll().then((commands) => {
      const key = (name: string) => commands.find((command) => command.name === name)?.shortcut || null;
      setShortcuts({ record: key('toggle-recording'), capture: key('capture-now') });
    });
  }, []);

  if (!update) return null;
  return {
    state: update.state,
    pauseReason: update.pauseReason ?? null,
    step: card.step,
    busy: card.busy,
    progress: card.progress,
    print: card.print,
    starting: false,
    shortcuts,
    aiFailure,
    narration:
      voice?.phase === 'recording' || voice?.phase === 'error'
        ? { level: 0, speaking: false, reason: voice.reason }
        : null,
  };
}
