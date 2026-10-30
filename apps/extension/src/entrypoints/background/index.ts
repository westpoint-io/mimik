import '@/lib/core-env';
import '@/lib/ui-env';
import { isLive } from '@mimik/core/capture/is-live';
import { logger } from '@mimik/core/logger';
import { browser, defineBackground } from '#imports';
import { isRecordableUrl } from '@/capture/recordable-tabs';
import { generateDescriptionOnDemand } from '@/core/capture/ai/guide-description';
import { mergeRecording } from '@/core/capture/ai/merge-recording';
import { rewriteSelection } from '@/core/capture/ai/rewrite';
import { validateApiKey } from '@/core/capture/ai/validate';
import { CaptureState } from '@/core/capture/machine';
import { stepRequiresManual } from '@/core/guideme/manual';
import { advanceSession, cancelSession, completeSession, getSession, startSession } from '@/core/guideme/session';
import { actionSteps } from '@/core/guides/blocks';
import {
  createGuide,
  getScreenshotsForSteps,
  getStepsForGuide,
  permanentlyDeleteGuide,
  softDeleteGuide,
} from '@/core/guides/service';
import type { Step } from '@/core/guides/types';
import { getActiveTab } from '@/lib/browser-api/get-active-tab';
import { localStorage } from '@/lib/browser-api/local-storage';
import { openSidebar } from '@/lib/browser-api/open-sidebar';
import { requestHostPermissions } from '@/lib/browser-api/request-host-permissions';
import { sendMessageToTab } from '@/lib/browser-api/send-message-to-tab';
import { setSidePanelBehavior } from '@/lib/browser-api/set-side-panel-behavior';
import { toggleSidebar } from '@/lib/browser-api/toggle-sidebar';
import { updateTab } from '@/lib/browser-api/update-tab';
import { recordInstall } from '@/lib/letter-notice/record-install';
import { onMessage } from '@/lib/messaging';
import { openGuideInFullview } from '@/lib/open-guide-in-fullview';
import { broadcastStateToPanel } from '@/lib/port/broadcast-state-to-panel';
import { setupPortListener } from '@/lib/port/setup-port-listener';
import { TabMessage } from '@/lib/tab-messages';
import { recordUpdate } from '@/lib/update-notice/record-update';
import { getActor, getStateUpdate, initActor, initActorFallback, waitUntilReady } from './actor';
import { generateGuideMetaOnStop } from './guide-meta';
import { registerNavigationListeners } from './navigation';
import { pauseCapture, resumeFromPause, whenPauseSettled } from './pause';
import { registerShortcuts } from './shortcuts';
import { handleCaptureStep, handleFinalizeInputStep, handleUpdateInputStep } from './step-pipeline';
import {
  broadcastAttachCapture,
  broadcastClearBlur,
  broadcastDetachCapture,
  broadcastDetachCaptureAndFlush,
  isInjectableTab,
  showNotificationOnTab,
} from './tab-manager';
import {
  abortVoiceNarration,
  canStartNarrationNow,
  getVoiceUpdate,
  registerVoiceListeners,
  startVoiceNarration,
  stopVoiceNarration,
  turnOffNarration,
  whenNarrationSettled,
} from './voice';

async function resolveManual(step: Step): Promise<boolean> {
  if (!step.screenshotId) return stepRequiresManual(step, null);
  const screenshots = await getScreenshotsForSteps([step.screenshotId]);
  return stepRequiresManual(step, screenshots.get(step.id));
}

async function startNarrationIfPossible(): Promise<boolean> {
  await waitUntilReady();
  const actor = getActor();
  if (!canStartNarrationNow(String(actor.getSnapshot().value), getVoiceUpdate().phase)) return false;
  const activeTab = await getActiveTab();
  await startVoiceNarration(activeTab?.id);
  return getVoiceUpdate().phase === 'recording';
}

async function startRecording(data: { url: string; insertTargetGuideId?: string; insertAtIndex?: number }) {
  await waitUntilReady();
  const actor = getActor();
  actor.send({
    type: 'START_RECORDING',
    url: data.url,
    insertTargetGuideId: data.insertTargetGuideId,
    insertAtIndex: data.insertAtIndex,
  });
  const guideId = actor.getSnapshot().context.currentGuideId!;

  await createGuide(guideId, data.insertTargetGuideId !== undefined);

  const activeTab = await getActiveTab();
  if (activeTab?.id) await showNotificationOnTab(activeTab.id);

  await startVoiceNarration(activeTab?.id);

  await broadcastAttachCapture(guideId);
  return { guideId };
}

async function stopRecording() {
  await waitUntilReady();
  await whenPauseSettled();
  const actor = getActor();
  const { currentGuideId: guideId, insertTargetGuideId, insertAtIndex } = actor.getSnapshot().context;
  await broadcastDetachCaptureAndFlush();
  await broadcastClearBlur();
  actor.send({ type: 'STOP_RECORDING' });

  const narrationStopped = guideId ? stopVoiceNarration(guideId) : Promise.resolve();

  if (guideId && insertTargetGuideId !== null && insertAtIndex !== null) {
    await narrationStopped;
    await mergeRecording(guideId, { insertTargetGuideId, insertAtIndex }, whenNarrationSettled);
    return { success: true, guideId: insertTargetGuideId, inserted: true };
  }

  if (guideId) {
    narrationStopped.then(() => generateGuideMetaOnStop(guideId)).catch(() => {});
  }

  return { success: true, guideId: guideId ?? undefined, inserted: false };
}

export default defineBackground(() => {
  logger.info('Background service worker started');

  browser.runtime.onInstalled.addListener(async (details) => {
    await recordUpdate(details.reason);
    await recordInstall(details.reason);
    if (details.reason !== 'install') return;
    if (import.meta.env.BROWSER === 'firefox') {
      try {
        await browser.permissions.remove({ origins: ['<all_urls>'] });
      } catch (err) {
        logger.warn('Failed to clear stale host permission on install', err);
      }
    }
    browser.tabs.create({ url: browser.runtime.getURL('/onboarding.html') });
  });

  setSidePanelBehavior(true);
  if (import.meta.env.BROWSER === 'firefox') {
    browser.action.onClicked.addListener(() => {
      toggleSidebar();
    });
  }
  initActor().catch(initActorFallback);
  cancelSession();
  registerNavigationListeners();
  registerVoiceListeners(startNarrationIfPossible);

  setupPortListener((port) => {
    logger.debug('Panel connected via port');
    waitUntilReady().then(() => {
      try {
        port.postMessage(getStateUpdate());
        port.postMessage(getVoiceUpdate());
      } catch {}
    });

    port.onDisconnect.addListener(() => {
      getSession().then((session) => {
        if (session?.active) {
          cancelSession();
          logger.debug('Guide Me cancelled: sidepanel closed');
        }
      });
    });
  });

  waitUntilReady().then(() => {
    getActor().subscribe(() => broadcastStateToPanel(getStateUpdate()));
  });

  const resume = () => resumeFromPause(startNarrationIfPossible);

  registerShortcuts({
    record: async () => {
      openSidebar();
      const permitted = requestHostPermissions();
      await waitUntilReady();
      if (isLive(getStateUpdate().state)) {
        const { guideId } = await stopRecording();
        if (guideId) await openGuideInFullview(guideId);
        return;
      }
      if (!(await permitted)) return;
      const tab = await getActiveTab();
      const url = tab?.url || tab?.pendingUrl || '';
      if (isRecordableUrl(url)) await startRecording({ url });
    },
    pause: async () => {
      await waitUntilReady();
      const { state } = getStateUpdate();
      if (state === CaptureState.RECORDING) await pauseCapture('manual');
      else if (state === CaptureState.PAUSED) await resume();
    },
    capture: async () => {
      await waitUntilReady();
      if (getStateUpdate().state !== CaptureState.RECORDING) return;
      const tab = await getActiveTab();
      if (tab?.id) await sendMessageToTab(tab.id, { type: TabMessage.CAPTURE_NOW });
    },
  });

  onMessage('getState', async () => {
    await waitUntilReady();
    return getStateUpdate();
  });

  onMessage('startRecording', ({ data }) => startRecording(data));

  onMessage('stopRecording', () => stopRecording());

  onMessage('discardRecording', async () => {
    await waitUntilReady();
    await whenPauseSettled();
    const actor = getActor();
    const { currentGuideId: guideId, insertTargetGuideId } = actor.getSnapshot().context;
    await broadcastDetachCapture();
    await broadcastClearBlur();
    actor.send({ type: 'STOP_RECORDING' });
    await abortVoiceNarration();
    if (!guideId) return { discarded: false };
    if (insertTargetGuideId !== null) await permanentlyDeleteGuide(guideId);
    else await softDeleteGuide(guideId);
    return { discarded: true };
  });

  onMessage('startNarration', async () => ({ started: await startNarrationIfPossible() }));

  onMessage('stopNarration', async () => {
    await waitUntilReady();
    await turnOffNarration(getActor().getSnapshot().context.currentGuideId);
    return { stopped: true };
  });

  onMessage('enterBlurMode', async () => {
    await waitUntilReady();
    const activeTab = await getActiveTab();
    if (!activeTab?.id || !isInjectableTab(activeTab)) return { entered: false };
    if (!(await pauseCapture('blur'))) return { entered: false };

    try {
      await sendMessageToTab(activeTab.id, { type: TabMessage.START_BLUR });
    } catch (err) {
      logger.warn('enterBlurMode: the tab could not open the overlay', err);
      await resume();
      return { entered: false };
    }
    return { entered: true };
  });

  onMessage('exitBlurMode', async () => {
    await waitUntilReady();
    return { exited: await resume() };
  });

  onMessage('pauseCapture', async () => {
    await waitUntilReady();
    return { paused: await pauseCapture('manual') };
  });

  onMessage('resumeCapture', async () => {
    await waitUntilReady();
    return { resumed: await resume() };
  });

  onMessage('generateGuideDescription', ({ data }) => generateDescriptionOnDemand(data.guideId));

  onMessage('validateApiKey', ({ data }) => validateApiKey(data.provider, data.apiKey, data.baseUrl, data.model));

  onMessage('listVoices', async ({ data }) => {
    const { fetchVoices } = await import('@/core/export/voiceover/client');
    return { voices: await fetchVoices(data.provider, data.apiKey).catch(() => []) };
  });

  onMessage('rewriteSelection', ({ data }) => rewriteSelection(data.text, data.instruction));

  onMessage('captureStep', async ({ data }) => {
    await waitUntilReady();
    return handleCaptureStep(data);
  });

  onMessage('updateInputStep', async ({ data }) => {
    await waitUntilReady();
    await handleUpdateInputStep(data.stepId, data.description, data.inputValue);
    return { updated: true };
  });

  onMessage('finalizeInputStep', async ({ data }) => {
    await waitUntilReady();
    await handleFinalizeInputStep(data.stepId, data.elementMeta, data.domContext, data.typed);
    return { updated: true };
  });

  onMessage('startGuideMe', async ({ data }) => {
    const steps = actionSteps(await getStepsForGuide(data.guideId));
    if (steps.length === 0) return { started: false, error: 'No steps' };

    const firstStep = steps.find((s) => s.elementMeta) ?? steps[0]!;
    if (!steps.some((s) => s.elementMeta)) return { started: false, error: 'Guide lacks element metadata' };

    await startSession(data.guideId, steps.length, firstStep, await resolveManual(firstStep));

    const activeTab = await getActiveTab();
    if (activeTab?.id && firstStep.url) {
      await updateTab(activeTab.id, { url: firstStep.url });
    }

    return { started: true };
  });

  onMessage('guideMeStepCompleted', async ({ data }) => {
    const sessionData = await localStorage.get(['guideMeSession']);
    const session = sessionData.guideMeSession as { guideId: string } | undefined;
    if (!session) return { advanced: false };

    const steps = actionSteps(await getStepsForGuide(session.guideId));
    const nextIndex = data.stepIndex + 1;

    if (nextIndex >= steps.length) {
      await completeSession();
      return { advanced: true, completed: true };
    }

    const nextStep = steps[nextIndex];
    if (!nextStep) {
      await completeSession();
      return { advanced: true, completed: true };
    }
    await advanceSession(nextStep, nextIndex, await resolveManual(nextStep));

    const currentTab = await getActiveTab();
    if (currentTab?.id && nextStep.url && nextStep.url !== currentTab.url) {
      await updateTab(currentTab.id, { url: nextStep.url });
    }

    return { advanced: true };
  });

  onMessage('guideMeCancel', async () => {
    await cancelSession();
    return { cancelled: true };
  });

  onMessage('guideMeGoTo', async ({ data }) => {
    const sessionData = await localStorage.get(['guideMeSession']);
    const session = sessionData.guideMeSession as { guideId: string } | undefined;
    if (!session) return { moved: false };

    const steps = actionSteps(await getStepsForGuide(session.guideId));
    const target = steps[data.stepIndex];
    if (!target) return { moved: false };
    await advanceSession(target, data.stepIndex, await resolveManual(target));

    const currentTab = await getActiveTab();
    if (currentTab?.id && target.url && target.url !== currentTab.url) {
      await updateTab(currentTab.id, { url: target.url });
    }

    return { moved: true };
  });
});
