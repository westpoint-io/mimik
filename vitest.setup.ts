import { vi } from "vitest";
import "@testing-library/jest-dom";

console.log = () => {};
console.info = () => {};
console.warn = () => {};
console.error = () => {};

class MemoryStorage implements Storage {
  #store = new Map<string, string>();

  get length() {
    return this.#store.size;
  }

  clear() {
    this.#store.clear();
  }

  getItem(key: string) {
    return this.#store.get(key) ?? null;
  }

  key(index: number) {
    return [...this.#store.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.#store.delete(key);
  }

  setItem(key: string, value: string) {
    this.#store.set(key, value);
  }
}

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: new MemoryStorage(),
});

Object.defineProperty(globalThis, "sessionStorage", {
  configurable: true,
  value: new MemoryStorage(),
});

const mockI18n = {
  i18n: {
    t: (key: string, subs?: string[]) => {
      if (subs?.length) return `${key}[${subs.join(",")}]`;
      return key;
    },
  },
};

vi.mock("#i18n", () => mockI18n);

vi.mock("#imports", () => ({
  ...mockI18n,
  browser: {
    i18n: {
      getMessage: (key: string) => key.replaceAll("_", "."),
      getUILanguage: () => "en-US",
    },
    storage: { local: { get: vi.fn(), set: vi.fn(), onChanged: { addListener: vi.fn(), removeListener: vi.fn() } } },
    runtime: { getManifest: () => ({ manifest_version: 3, name: "Mimik", version: "1.0.0" }) },
    tabs: {},
  },
  defineBackground: vi.fn(),
  defineContentScript: vi.fn(),
}));

vi.mock("wxt/testing", async () => {
  const actual = await vi.importActual<any>("wxt/testing");
  return {
    ...actual,
    fakeBrowser: {
      ...actual.fakeBrowser,
      i18n: {
        ...actual.fakeBrowser.i18n,
        getMessage: (key: string) => key.replaceAll("_", "."),
        getUILanguage: () => "en-US",
      },
      runtime: {
        ...actual.fakeBrowser.runtime,
        getManifest: () => ({
          manifest_version: 3,
          name: "Mimik",
          version: "1.0.0",
          description: "Test manifest",
        }),
      },
    },
  };
});

// jsdom rejects the Uint8Array that a TextEncoder from another realm hands back,
// so re-wrap the bytes in this realm's Uint8Array. The encoding itself stays
// native UTF-8: hand-rolling it as one byte per code unit truncates anything
// outside latin1, which silently corrupts multi-byte text and makes any real
// fetch fail with "body length does not match content-length header".
class ESBuildAndJSDOMCompatibleTextEncoder extends TextEncoder {
  encode(input = "") {
    if (typeof input !== "string") {
      throw new TypeError("`input` must be a string");
    }
    return Uint8Array.from(super.encode(input));
  }
}

globalThis.TextEncoder = ESBuildAndJSDOMCompatibleTextEncoder;
