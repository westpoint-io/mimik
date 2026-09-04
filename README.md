<div align="center"><a name="readme-top"></a>

<img src="public/mascot.svg" width="140" height="140" alt="Mimik mascot" />

# Mimik

**English** · [Español](./README.es.md) · [Português (BR)](./README.pt-BR.md) · [Français](./README.fr.md)

**Auto-capture any browser workflow into a step-by-step guide. No account, no cloud, no tracking.**

Click record, do the thing, get a polished guide with annotated screenshots. Narrate it as you go, edit it after, then replay or export.

<!-- SHIELD GROUP -->

[![License][license-shield]][license-link]
[![Manifest V3][mv3-shield]][mv3-link]
[![100% Local][local-shield]][local-link]
[![No Account][no-account-shield]][no-account-link]
<br/>
[![Stars][star-shield]][star-link]
[![Contributors][contributors-shield]][contributors-link]
![Last Commit][last-commit-shield]
[![Issues][issues-shield]][issues-link]

</div>

<details>
<summary><kbd>Table of contents</kbd></summary>

#### TOC

- [📺 Demo](#-demo)
- [👋 Getting Started](#-getting-started)
- [✨ Features](#-features)
  - [🔒 Smart Blur](#-smart-blur)
  - [🧠 AI descriptions (optional)](#-ai-descriptions-optional)
  - [▶️ Guide Me replay](#️-guide-me-replay)
  - [🎙️ Voice narration (optional)](#️-voice-narration-optional)
  - [✏️ Guide editor](#️-guide-editor)
  - [📤 Multi-format export](#-multi-format-export)
- [🔐 Privacy & storage](#-privacy--storage)
- [🤝 Contributing](#-contributing)
- [📜 License](#-license)

<br/>

</details>

## 📺 Demo

<div align="center">
<img src="https://github.com/user-attachments/assets/9de20b45-2256-4127-8242-141cf1802f39" alt="Mimik demo" width="800" />
</div>

## 👋 Getting Started

Mimik turns any repetitive browser task into a documented, shareable guide in seconds. It runs entirely in your browser. No backend, no account, no telemetry, and nothing ever leaves your device.

Whether you're documenting internal tools, writing product tutorials, or onboarding a teammate, Mimik captures every click, keystroke, and navigation automatically so you can focus on the work.

Every meaningful action becomes a step: clicks on buttons and links, form inputs, keyboard shortcuts, clipboard actions, drag events, and page navigations. Rapid clicks on nearby elements are merged so guides stay clean, and clicks are intercepted before the page navigates away, so nothing is lost on SPAs or full page loads.

Each step gets a screenshot with the clicked element highlighted and zoomed in. No manual cropping, no annotation tools to learn.

| Browser | Version | Install |
| ------- | ------- | ------- |
| Chrome  | [![Chrome Version][chrome-version-shield]][chrome-link]   | [Chrome Web Store][chrome-link] |
| Firefox | [![Firefox Version][firefox-version-shield]][firefox-link] | [Firefox Add-ons][firefox-link]  |
| Edge    | [![Edge Version][edge-version-shield]][edge-link]          | [Microsoft Edge Add-ons][edge-link] |

Available in English, Spanish, Brazilian Portuguese, French, and German. The AI description language is set separately, so you can run Mimik in English and generate guides in Spanish, or any combination.

> \[!IMPORTANT]
>
> **⭐️ Star the repo** if Mimik saves you time. It helps other people discover it!

<a href="https://github.com/westpoint-io/mimik">
  <img width="100%" alt="Star Mimik on GitHub" src="https://github.com/user-attachments/assets/80d304da-a765-4bde-bf49-b1bdcb4fe804" />
</a>

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

## ✨ Features

### 🔒 Smart Blur

Mimik automatically detects and blurs sensitive data in your screenshots: emails, phone numbers, SSNs, credit cards, IP addresses, MAC addresses. Toggle each category independently.

Need to blur something custom? The manual blur picker lets you select any DOM element and mask it across every screenshot where it appears.

<img src="https://github.com/user-attachments/assets/968d2518-c561-4d68-92a6-3d5f569fe38a" alt="Smart Blur" width="800" />

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

### 🧠 AI descriptions (optional)

Bring your own API key (OpenAI, Anthropic, or OpenRouter) and Mimik generates human-readable step descriptions like *"Click the **Submit** button to save changes"* instead of the rule-based `Click Submit`.

Descriptions are generated from a lightweight DOM context (~50-100 tokens), not screenshots. Roughly 15-30x cheaper than vision models. Choose the language you want descriptions in (English, Spanish, Portuguese, French, German).

<img src="https://github.com/user-attachments/assets/3540cbd5-133f-46fd-a9b6-ffce9b4d422a" alt="AI descriptions" width="800" />

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

### ▶️ Guide Me replay

Replay any guide live on a real page. Mimik highlights the next element to click, tracks your progress step by step, and advances automatically as you interact. Perfect for onboarding teammates or walking through a process yourself.

<img src="https://github.com/user-attachments/assets/56ffca1d-5074-491f-8571-dd70782d4b05" alt="Guide Me replay" width="800" />

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

### 🎙️ Voice narration (optional)

Talk through the workflow out loud while you record and Mimik turns what you said into the step
descriptions. Audio is transcribed with your own key (OpenAI or Groq) and matched to the steps it
belongs to, so you narrate once instead of writing every step by hand.

<img src="https://github.com/user-attachments/assets/061fddc7-da65-4641-8b39-d30b80c36531" alt="Voice narration" width="800" />

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

### ✏️ Guide editor

Fix a guide after the fact without re-recording. Crop, annotate and redact any screenshot, rewrite a
step with AI inline, drop headings and notes between steps, reorder or bulk-delete, and roll back
through version history.

<img src="https://github.com/user-attachments/assets/62d3a01e-b129-44c8-8ba3-e9b97ff08d7e" alt="Guide editor" width="800" />

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

### 📤 Multi-format export

Share guides in whatever format fits your workflow:

- **Video**: narrated walkthrough, mp4/H.264, with the cursor moving to each target
- **PDF**: print-ready, A4 portrait with auto page breaks
- **DOCX**: open and keep editing in Word
- **HTML**: self-contained, share anywhere, base64-embedded images
- **Markdown**: paste into Notion, GitHub, internal docs, wikis

All exports are generated client-side. Nothing touches a server.

<img src="https://github.com/user-attachments/assets/e7584527-7d68-4f3f-9261-8380ee08dfb4" alt="Multi-format export" width="800" />

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

## 🔐 Privacy & storage

Guides, steps, and screenshots live on your device. There's no backend, no account, no telemetry. Your API keys (if you bring one) never leave your browser — they're stored locally and used to call the provider you chose directly.

Two things do leave the browser, both documented in the [privacy policy](https://mimik.westpoint.io/privacy/): site icons are fetched from Google's favicon service, which sends that site's domain, and the optional AI and voice features send text or audio to the provider you configured.

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

## 🤝 Contributing

Contributions of all kinds are welcome: bug reports, feature requests, PRs, and translations.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, project layout, and contributor guidelines.

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

## 📜 License

MIT © [Westpoint](https://github.com/westpoint-io). See [LICENSE](./LICENSE) for details.

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

<!-- LINK GROUP -->

[back-to-top]: https://img.shields.io/badge/-BACK_TO_TOP-1E1B4B?style=flat-square

[license-shield]: https://img.shields.io/badge/license-MIT-4F46E5?style=flat-square&labelColor=1E1B4B
[license-link]: ./LICENSE

[mv3-shield]: https://img.shields.io/badge/manifest-v3-3730A3?style=flat-square&labelColor=1E1B4B
[mv3-link]: https://developer.chrome.com/docs/extensions/mv3/intro/

[local-shield]: https://img.shields.io/badge/storage-100%25%20local-4F46E5?style=flat-square&labelColor=1E1B4B
[local-link]: #-100-local-storage

[no-account-shield]: https://img.shields.io/badge/account-not%20required-4F46E5?style=flat-square&labelColor=1E1B4B
[no-account-link]: #-100-local-storage

[star-shield]: https://img.shields.io/github/stars/westpoint-io/mimik?style=flat-square&label=stars&color=4F46E5&labelColor=1E1B4B
[star-link]: https://github.com/westpoint-io/mimik/stargazers

[contributors-shield]: https://img.shields.io/github/contributors/westpoint-io/mimik?style=flat-square&labelColor=1E1B4B
[contributors-link]: https://github.com/westpoint-io/mimik/graphs/contributors

[last-commit-shield]: https://img.shields.io/github/last-commit/westpoint-io/mimik?style=flat-square&label=commit&labelColor=1E1B4B

[issues-shield]: https://img.shields.io/github/issues/westpoint-io/mimik?style=flat-square&labelColor=1E1B4B
[issues-link]: https://github.com/westpoint-io/mimik/issues

[chrome-version-shield]: https://img.shields.io/chrome-web-store/v/jmfohdaflahliammccpiadmkcibohgha?label=Chrome%20Version&style=flat-square&logo=googlechrome&logoColor=C7D2FE&color=4F46E5&labelColor=1E1B4B
[chrome-link]: https://chromewebstore.google.com/detail/mimik/jmfohdaflahliammccpiadmkcibohgha
[firefox-version-shield]: https://img.shields.io/amo/v/mimik?label=Firefox%20Version&style=flat-square&logo=firefoxbrowser&logoColor=C7D2FE&color=4F46E5&labelColor=1E1B4B
[firefox-link]: https://addons.mozilla.org/en-US/firefox/addon/mimik/
[edge-version-shield]: https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fmicrosoftedge.microsoft.com%2Faddons%2Fgetproductdetailsbycrxid%2Fhgjemhfoffebbollleajkpefblppleai&query=%24.version&label=Edge%20Version&style=flat-square&logo=microsoftedge&logoColor=C7D2FE&color=4F46E5&labelColor=1E1B4B
[edge-link]: https://microsoftedge.microsoft.com/addons/detail/hgjemhfoffebbollleajkpefblppleai
</content>
</invoke>