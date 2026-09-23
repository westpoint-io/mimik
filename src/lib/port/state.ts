import type { PanelVoiceUpdate, Port } from './types';

export const panelPorts = new Set<Port>();

export const observerPorts = new Set<Port>();

export const lastVoice: { current: PanelVoiceUpdate | null } = { current: null };
