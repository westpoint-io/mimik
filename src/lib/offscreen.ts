import { logger } from '@mimik/core/logger';
import { createTab, getExtensionURL, onMessage, sendMessage } from './browser-api';
import { localVoiceHost } from './voice-local';
import {
  isVoiceMessageFor,
  VOICE_BACKGROUND_TARGET,
  VOICE_OFFSCREEN_TARGET,
  VOICE_SIDEPANEL_TARGET,
  type VoiceAbortRequest,
  type VoiceAbortResponse,
  type VoiceFlushRequest,
  type VoiceFlushResponse,
  VoiceMessage,
  type VoicePermissionQueryRequest,
  type VoicePermissionQueryResponse,
  type VoicePermissionResultEvent,
  type VoiceRequest,
  type VoiceStartRequest,
  type VoiceStartResponse,
  type VoiceStatusRequest,
  type VoiceStatusResponse,
  type VoiceStepMark,
  type VoiceStopRequest,
  type VoiceStopResponse,
  type VoiceTranscriptionSettings,
  voiceMessage,
} from './voice-messages';
import { isVoiceStatus } from './voice-recovery';

const IS_FIREFOX = import.meta.env.BROWSER === 'firefox';

const OFFSCREEN_PATH = '/offscreen.html';
const MIC_PERMISSION_PATH = '/mic-permission.html';
const OFFSCREEN_REASON = 'USER_MEDIA';
const OFFSCREEN_JUSTIFICATION = 'Recording microphone narration while a guide is being captured';
const OFFSCREEN_CONTEXT = 'OFFSCREEN_DOCUMENT';

interface OffscreenApi {
  createDocument(options: { url: string; reasons: string[]; justification: string }): Promise<void>;
  closeDocument(): Promise<void>;
}

interface ContextsApi {
  getContexts(filter: { contextTypes: string[] }): Promise<unknown[]>;
}

function offscreenApi(): OffscreenApi | undefined {
  return (globalThis as { chrome?: { offscreen?: OffscreenApi } }).chrome?.offscreen;
}

function contextsApi(): ContextsApi | undefined {
  const runtime = (globalThis as { chrome?: { runtime?: Partial<ContextsApi> } }).chrome?.runtime;
  return typeof runtime?.getContexts === 'function' ? (runtime as ContextsApi) : undefined;
}

let creating: Promise<void> | null = null;

export function supportsOffscreen(): boolean {
  return offscreenApi() !== undefined;
}

export async function hasOffscreenDocument(): Promise<boolean> {
  const api = contextsApi();
  if (!api) return false;
  try {
    const contexts = await api.getContexts({ contextTypes: [OFFSCREEN_CONTEXT] });
    return contexts.length > 0;
  } catch {
    return false;
  }
}

export async function ensureOffscreenDocument(): Promise<boolean> {
  const api = offscreenApi();
  if (!api) return false;
  if (await hasOffscreenDocument()) return true;

  creating ??= api.createDocument({
    url: getExtensionURL(OFFSCREEN_PATH),
    reasons: [OFFSCREEN_REASON],
    justification: OFFSCREEN_JUSTIFICATION,
  });

  try {
    await creating;
    return true;
  } catch (error) {
    logger.error('voice: failed to create the offscreen document', error);
    return hasOffscreenDocument();
  } finally {
    creating = null;
  }
}

export async function closeOffscreenDocument(): Promise<void> {
  const api = offscreenApi();
  if (!api) return;
  if (!(await hasOffscreenDocument())) return;
  try {
    await api.closeDocument();
  } catch (error) {
    logger.error('voice: failed to close the offscreen document', error);
  }
}

async function requestMicrophoneInPage(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
    return true;
  } catch (error) {
    logger.warn('voice: microphone access was not granted', error);
    return false;
  }
}

async function promptForMicrophone(): Promise<void> {
  const granted = await requestMicrophoneInPage();
  void sendMessage(
    voiceMessage<VoicePermissionResultEvent>({
      type: VoiceMessage.VOICE_PERMISSION_RESULT,
      target: VOICE_BACKGROUND_TARGET,
      state: granted ? 'granted' : 'denied',
    }) as unknown as Record<string, unknown>,
  ).catch(() => undefined);
}

export function openMicPermissionPage(tabId?: number): Promise<unknown> {
  if (IS_FIREFOX) {
    if (localVoiceHost() === null) return Promise.resolve(undefined);
    return promptForMicrophone();
  }
  const url = getExtensionURL(tabId === undefined ? MIC_PERMISSION_PATH : `${MIC_PERMISSION_PATH}?tabId=${tabId}`);
  return createTab({ url, active: true });
}

function request<T>(message: VoiceRequest): Promise<T> {
  const local = IS_FIREFOX ? localVoiceHost() : null;
  if (local) return local.handle(message) as Promise<T>;
  return sendMessage(message as unknown as Record<string, unknown>) as Promise<T>;
}

export function supportsVoice(): boolean {
  return IS_FIREFOX || supportsOffscreen();
}

export function ensureVoiceHost(): Promise<boolean> {
  if (IS_FIREFOX) return Promise.resolve(true);
  return ensureOffscreenDocument();
}

export async function hasVoiceHost(): Promise<boolean> {
  if (!IS_FIREFOX) return hasOffscreenDocument();
  return isVoiceStatus(await getVoiceStatus().catch(() => null));
}

export async function closeVoiceHost(): Promise<void> {
  if (IS_FIREFOX) return;
  await closeOffscreenDocument();
}

export async function closeVoiceHostIfIdle(): Promise<void> {
  if (IS_FIREFOX) return;
  const status = await getVoiceStatus().catch(() => null);
  if (!isVoiceStatus(status)) {
    logger.warn('voice: host status unavailable, leaving the document open');
    return;
  }
  if (status.recording || status.transcribing) return;
  await closeOffscreenDocument();
}

export function registerVoicePanelRelay(): void {
  if (!IS_FIREFOX) return;
  onMessage((message) => {
    if (!isVoiceMessageFor(VOICE_SIDEPANEL_TARGET, message)) return undefined;
    void sendMessage(message as unknown as Record<string, unknown>).catch(() => undefined);
    return undefined;
  });
}

async function answered<T>(message: VoiceRequest, missing: T): Promise<T> {
  const response = await request<T | undefined>(message).catch((error: unknown) => {
    logger.warn('voice: the microphone host did not answer', message.type, error);
    return undefined;
  });
  return response ?? missing;
}

export function startVoiceCapture(deviceId?: string): Promise<VoiceStartResponse> {
  return answered<VoiceStartResponse>(
    voiceMessage<VoiceStartRequest>({ type: VoiceMessage.VOICE_START, target: VOICE_OFFSCREEN_TARGET, deviceId }),
    { started: false, reason: 'unsupported', error: 'No microphone host is available' },
  );
}

export function stopVoiceCapture(
  guideId: string,
  steps: VoiceStepMark[],
  settings: VoiceTranscriptionSettings,
): Promise<VoiceStopResponse> {
  return answered<VoiceStopResponse>(
    voiceMessage<VoiceStopRequest>({
      type: VoiceMessage.VOICE_STOP,
      target: VOICE_OFFSCREEN_TARGET,
      guideId,
      steps,
      settings,
    }),
    { ok: false, reason: 'stream-ended', error: 'The microphone host is no longer available' },
  );
}

export function flushVoiceCapture(
  guideId: string,
  step: VoiceStepMark,
  settings: VoiceTranscriptionSettings,
): Promise<VoiceFlushResponse> {
  return answered<VoiceFlushResponse>(
    voiceMessage<VoiceFlushRequest>({
      type: VoiceMessage.VOICE_FLUSH,
      target: VOICE_OFFSCREEN_TARGET,
      guideId,
      step,
      settings,
    }),
    { ok: false, reason: 'stream-ended', error: 'The microphone host is no longer available' },
  );
}

export function abortVoiceCapture(): Promise<VoiceAbortResponse> {
  return request(voiceMessage<VoiceAbortRequest>({ type: VoiceMessage.VOICE_ABORT, target: VOICE_OFFSCREEN_TARGET }));
}

export function getVoiceStatus(): Promise<VoiceStatusResponse> {
  return request(voiceMessage<VoiceStatusRequest>({ type: VoiceMessage.VOICE_STATUS, target: VOICE_OFFSCREEN_TARGET }));
}

export function queryMicPermission(): Promise<VoicePermissionQueryResponse> {
  return request(
    voiceMessage<VoicePermissionQueryRequest>({
      type: VoiceMessage.VOICE_PERMISSION_QUERY,
      target: VOICE_OFFSCREEN_TARGET,
    }),
  );
}
