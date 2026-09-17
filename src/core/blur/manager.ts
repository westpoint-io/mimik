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
};

const EVENTS = ['mimik-blur:update-presets', 'mimik-blur:start-picker', 'mimik-blur:reset', 'mimik-blur:done'] as const;

export class BlurManager {
  private scanner = new BlurScanner();
  private picker = new ElementPicker();
  private panel: BlurPanel | null = null;
  private active = false;
  private generation = 0;

  async start() {
    if (this.active) return;
    this.active = true;

    // A stop or dismiss can land while the presets load, and so can a second
    // start() after one. `active` alone cannot tell "still the same start" from
    // "stopped and started again", and a stale continuation that mounts a panel
    // drops the reference to the live one, leaving it in the DOM unclosable.
    const generation = ++this.generation;

    injectBlurStyles();
    const presets = await this.loadPresets();
    if (!this.active || generation !== this.generation) return;

    const activeKeys = (Object.entries(presets) as [PresetKey, boolean][]).filter(([, on]) => on).map(([k]) => k);

    this.scanner.start(activeKeys);
    this.panel?.unmount();
    this.panel = new BlurPanel(presets);
    this.panel.mount();

    for (const event of EVENTS) document.addEventListener(event, this.handleEvent);
  }

  /**
   * Closes the overlay and removes every mask. For the end of a recording.
   *
   * Only the teardown is conditional on `active`: "Done" already tore the panel
   * down and left the masks in place, so gating the whole method would make this
   * a no-op on the one path that matters — the page would keep its injected
   * style, its mask spans and its blurred inputs until the user reloaded, and
   * the surviving attributes would keep withholding input values from the next
   * recording. Both calls below are idempotent on a page that never blurred.
   */
  stop() {
    if (this.active) this.teardown();
    this.scanner.stop();
    removeBlurStyles();
  }

  /**
   * Closes the overlay but leaves the masks in place, which is what "Done"
   * does: the point of picking them is that later screenshots keep them.
   */
  dismiss() {
    if (!this.active) return;
    this.teardown();
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
