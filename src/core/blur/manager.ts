import { browser } from '#imports';
import { sendMessage } from '@/lib/messaging';
import { ElementPicker } from './element-picker';
import { BlurPanel } from './panel';
import type { PresetKey } from './regexes';
import { BlurScanner } from './scanner';
import { injectBlurStyles, removeBlurStyles } from './styles';

const DEFAULT_PRESETS: Record<PresetKey, boolean> = {
  email: true,
  phone: true,
  ssn: false,
  creditCard: false,
  ipAddress: false,
  macAddress: false,
  ukPhone: false,
  ukPostcode: false,
  ukNino: false,
  ukSortCode: false,
};

const EVENTS = ['mimik-blur:update-presets', 'mimik-blur:start-picker', 'mimik-blur:reset', 'mimik-blur:done'] as const;

export class BlurManager {
  private scanner = new BlurScanner();
  private picker = new ElementPicker();
  private panel: BlurPanel | null = null;
  private active = false;

  async start() {
    if (this.active) return;
    this.active = true;

    injectBlurStyles();
    const presets = await this.loadPresets();
    const activeKeys = (Object.entries(presets) as [PresetKey, boolean][]).filter(([, on]) => on).map(([k]) => k);

    this.scanner.start(activeKeys);
    this.panel = new BlurPanel(presets);
    this.panel.mount();

    for (const event of EVENTS) document.addEventListener(event, this.handleEvent);
  }

  stop() {
    if (!this.active) return;
    this.teardown();
    this.scanner.stop();
    removeBlurStyles();
  }

  private teardown() {
    this.active = false;
    this.panel?.unmount();
    this.panel = null;
    this.scanner.detach();
    this.picker.stop();
    for (const event of EVENTS) document.removeEventListener(event, this.handleEvent);
  }

  private handleEvent = (e: Event) => {
    switch (e.type) {
      case 'mimik-blur:update-presets': {
        const activeKeys = (e as CustomEvent<{ presets: PresetKey[] }>).detail.presets;
        this.scanner.updatePresets(activeKeys);
        this.savePresets(activeKeys);
        break;
      }
      case 'mimik-blur:start-picker':
        this.picker.start(() => this.picker.stop());
        break;
      case 'mimik-blur:reset':
        this.scanner.unblurAll();
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
      ukPhone: false,
      ukPostcode: false,
      ukNino: false,
      ukSortCode: false,
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
