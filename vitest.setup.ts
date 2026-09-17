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

class ESBuildAndJSDOMCompatibleTextEncoder extends TextEncoder {
  constructor() {
    super();
  }

  encode(input: string) {
    if (typeof input !== "string") {
      throw new TypeError("`input` must be a string");
    }
    const utf8 = Buffer.from(input, "utf8");
    const arr = new Uint8Array(utf8.length);
    arr.set(utf8);
    return arr;
  }
}

globalThis.TextEncoder = ESBuildAndJSDOMCompatibleTextEncoder;
