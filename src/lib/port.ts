import { browser } from '#imports';
import type { AiFailureReason } from '@/core/capture/ai/errors';
import type { CaptureStateValue } from '@/core/capture/machine';
import { logger } from '@/lib/logger';
import type { VoiceErrorReason } from '@/lib/voice-messages';

const PORT_NAME = 'mimik-panel';
const OBSERVER_PORT_NAME = 'mimik-panel-observer';

export interface PanelStateUpdate {
  type: 'STATE_UPDATE';
  state: CaptureStateValue;
  stepCount: number;
  currentGuideId: string | null;
}

export type VoicePhase = 'idle' | 'recording' | 'transcribing' | 'error';

export interface PanelVoiceUpdate {
  type: 'VOICE_UPDATE';
  phase: VoicePhase;
  reason?: VoiceErrorReason;
  error?: string;
  narrated?: number;
}

export interface PanelAiUpdate {
  type: 'AI_UPDATE';
  reason: AiFailureReason;
  status?: number;
  provider: string;
}

type PortMessage = PanelStateUpdate | PanelVoiceUpdate | PanelAiUpdate;
type Port = ReturnType<typeof browser.runtime.connect>;

function openPort(
  name: string,
  onPortMessage: (msg: PortMessage) => void,
  onConnect?: () => void,
  onDisconnect?: () => void,
): () => void {
  let port: Port | null = null;
  let destroyed = false;

  function connect() {
    if (destroyed) return;

    try {
      port = browser.runtime.connect({ name });
      logger.debug('Port connected to background', name);
      onConnect?.();

      port.onMessage.addListener(onPortMessage);

      port.onDisconnect.addListener(() => {
        port = null;
        if (!destroyed) {
          logger.debug('Port disconnected, reconnecting in 1s...');
          onDisconnect?.();
          setTimeout(connect, 1000);
        }
      });
    } catch {
      if (!destroyed) {
        logger.debug('Port connect failed, retrying in 1s...');
        setTimeout(connect, 1000);
      }
    }
  }

  connect();

  return () => {
    destroyed = true;
    port?.disconnect();
    port = null;
  };
}

export function connectToBackground(callbacks: {
  onStateUpdate: (update: PanelStateUpdate) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onVoiceUpdate?: (update: PanelVoiceUpdate) => void;
  onAiUpdate?: (update: PanelAiUpdate) => void;
}): () => void {
  return openPort(
    PORT_NAME,
    (msg) => {
      if (msg.type === 'STATE_UPDATE') {
        callbacks.onStateUpdate(msg);
      } else if (msg.type === 'VOICE_UPDATE') {
        callbacks.onVoiceUpdate?.(msg);
      } else if (msg.type === 'AI_UPDATE') {
        callbacks.onAiUpdate?.(msg);
      }
    },
    callbacks.onConnect,
    callbacks.onDisconnect,
  );
}

export function observeVoiceFromBackground(
  onVoiceUpdate: (update: PanelVoiceUpdate) => void,
  onConnect?: () => void,
): () => void {
  return openPort(
    OBSERVER_PORT_NAME,
    (msg) => {
      if (msg.type === 'VOICE_UPDATE') onVoiceUpdate(msg);
    },
    onConnect,
  );
}

const panelPorts = new Set<Port>();
const observerPorts = new Set<Port>();
let lastVoiceUpdate: PanelVoiceUpdate | null = null;

export function setupPortListener(onPanelConnect?: (port: Port) => void) {
  browser.runtime.onConnect.addListener((port) => {
    if (port.name === OBSERVER_PORT_NAME) {
      observerPorts.add(port);
      if (lastVoiceUpdate) postTo(port, lastVoiceUpdate);
      port.onDisconnect.addListener(() => {
        observerPorts.delete(port);
      });
      return;
    }

    if (port.name !== PORT_NAME) return;

    panelPorts.add(port);
    onPanelConnect?.(port);

    port.onDisconnect.addListener(() => {
      panelPorts.delete(port);
    });
  });
}

function postTo(port: Port, message: PortMessage): boolean {
  try {
    port.postMessage(message);
    return true;
  } catch {
    return false;
  }
}

function broadcastTo(ports: Set<Port>, message: PortMessage): void {
  for (const port of ports) {
    if (!postTo(port, message)) ports.delete(port);
  }
}

export function broadcastStateToPanel(update: PanelStateUpdate): void {
  broadcastTo(panelPorts, update);
}

export function broadcastAiToPanel(update: PanelAiUpdate): void {
  broadcastTo(panelPorts, update);
}

export function broadcastVoiceToPanel(update: PanelVoiceUpdate): void {
  lastVoiceUpdate = update;
  broadcastTo(panelPorts, update);
  broadcastTo(observerPorts, update);
}
