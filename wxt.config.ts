import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  modules: ["@wxt-dev/module-react", "@wxt-dev/i18n/module"],
  srcDir: "src",
  imports: false,
  webExt: {
    chromiumArgs: ['--user-data-dir=/tmp/mimik-dev-profile', '--window-size=1280,800', '--window-position=0,0', '--force-device-scale-factor=1.25'],
  },
  zip: {
    excludeSources: [
      "mockups/**",
      "docs/**",
      ".claude/**",
      ".planning/**",
      ".worktrees/**",
      "CLAUDE.md",
      "AGENTS.md",
      "CONTRIBUTING.md",
    ],
  },
  alias: {
    '@': 'src',
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  hooks: {
    'build:manifestGenerated': (wxt, manifest) => {
      if (wxt.config.browser === 'firefox' && manifest.sidebar_action) {
        (manifest.sidebar_action as Record<string, unknown>).open_at_install = false;
        (manifest.sidebar_action as Record<string, unknown>).default_icon = 'icon32.png';
      }
    },
  },
  manifest: ({ browser }) => {
    const isFirefox = browser === 'firefox';
    return {
      name: "__MSG_app_store_title__",
      description: "__MSG_app_description__",
      default_locale: "en",
      permissions: [
        "storage",
        "activeTab",
        "tabs",
        "scripting",
        "unlimitedStorage",
        "webNavigation",
        ...(isFirefox ? [] : ["sidePanel"]),
      ],
      ...(isFirefox
        ? { optional_host_permissions: ["<all_urls>"] }
        : { host_permissions: ["<all_urls>"], minimum_chrome_version: "118" }),
      icons: {
        16: 'icon16.png',
        32: 'icon32.png',
        48: 'icon48.png',
        128: 'icon128.png',
      },
      action: {},
      commands: {
        'toggle-recording': {
          suggested_key: {
            default: 'Ctrl+Shift+R',
            mac: 'Command+Shift+R',
          },
          description: 'Start or stop a Mimik recording',
        },
      },
      ...(isFirefox
        ? {
            sidebar_action: {
              default_panel: "sidepanel.html",
              default_icon: "icon32.png",
              default_title: "Mimik",
              open_at_install: false,
            },
            browser_specific_settings: {
              gecko: {
                id: "mimik@westpoint.io",
                strict_min_version: "128.0",
                data_collection_permissions: {
                  required: ["none"],
                },
              },
            },
          }
        : {
            side_panel: {
              default_path: "sidepanel/index.html",
            },
          }),
    };
  },
});
