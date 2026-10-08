import { browser } from '#imports';
import type { BlurDetector } from '@/core/blur/detector';
import { DEFAULT_PRESETS, type PresetKey } from '@/core/blur/patterns';
import { PageRedactor } from '@/core/blur/redactor';
import { addRedactStyles, removeRedactStyles } from '@/core/blur/styles';
import { sendMessage } from '@/lib/messaging';
import { ElementPicker } from './element-picker';
import { mountBlurPanel } from './mount-blur-panel';

const EVENTS = ['mimik-blur:update-presets', 'mimik-blur:start-picker', 'mimik-blur:reset', 'mimik-blur:done'] as const;

export class BlurManager {
  private picker = new ElementPicker();
  private unmountPanel: (() => void) | null = null;
  private active = false;
  private generation = 0;

  constructor(private detector: BlurDetector = new PageRedactor()) {}

  async start() {
    if (this.active) return;
    this.active = true;

    const generation = ++this.generation;

    addRedactStyles();
    const presets = await this.loadPresets();
    if (!this.active || generation !== this.generation) return;

    const activeKeys = (Object.entries(presets) as [PresetKey, boolean][]).filter(([, on]) => on).map(([k]) => k);

    this.detector.start(activeKeys);
    this.unmountPanel?.();
    this.unmountPanel = mountBlurPanel(presets);

    for (const event of EVENTS) document.addEventListener(event, this.handleEvent);
  }

  stop() {
    if (this.active) this.teardown();
    this.detector.stop();
    removeRedactStyles();
  }

  dismiss() {
    if (!this.active) return;
    this.teardown();
  }

  private teardown() {
    this.active = false;
    this.unmountPanel?.();
    this.unmountPanel = null;
    this.detector.detach();
    this.picker.stop();
    for (const event of EVENTS) document.removeEventListener(event, this.handleEvent);
  }

  private handleEvent = (e: Event) => {
    switch (e.type) {
      case 'mimik-blur:update-presets': {
        const activeKeys = (e as CustomEvent<{ presets: PresetKey[] }>).detail.presets;
        this.detector.updatePresets(activeKeys);
        this.savePresets(activeKeys);
        break;
      }
      case 'mimik-blur:start-picker':
        this.picker.start(() => this.picker.stop());
        break;
      case 'mimik-blur:reset':
        this.detector.unblurAll();
        break;
      case 'mimik-blur:done':
        this.teardown();
        sendMessage('exitBlurMode', undefined).catch(() => {});
        break;
    }
  };

  private savePresets(activeKeys: PresetKey[]) {
    const presets: Record<PresetKey, boolean> = {
      email: false,
      phone: false,
      ssn: false,
      creditCard: false,
      ipAddress: false,
      macAddress: false,
    };
    for (const key of activeKeys) presets[key] = true;
    browser.storage.local.set({ blurPresets: presets });
  }

  private async loadPresets(): Promise<Record<PresetKey, boolean>> {
    try {
      const stored = await browser.storage.local.get(['blurPresets']);
      return (stored.blurPresets as Record<PresetKey, boolean>) || DEFAULT_PRESETS;
    } catch {
      return DEFAULT_PRESETS;
    }
  }
}
