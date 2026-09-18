<div align="center"><a name="readme-top"></a>

<img src="public/mascot.svg" width="140" height="140" alt="Mascote do Mimik" />

# Mimik

[English](./README.md) · [Español](./README.es.md) · **Português (BR)** · [Français](./README.fr.md) · [简体中文](./README.zh-CN.md)

**Captura qualquer fluxo no navegador e transforma num guia passo a passo. Sem conta, sem nuvem, sem rastreio.**

Clica em gravar, faz o que precisa, e recebe um guia caprichado com capturas de tela anotadas. Edita, reproduz ou exporta.

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
<summary><kbd>Sumário</kbd></summary>

#### TOC

- [📺 Demo](#-demo)
- [👋 Começando](#-começando)
- [✨ Funcionalidades](#-funcionalidades)
  - [🔒 Smart Blur](#-smart-blur)
  - [🧠 Descrições por IA (opcional)](#-descrições-por-ia-opcional)
  - [▶️ Reprodução Guide Me](#️-reprodução-guide-me)
  - [🎙️ Narração por voz (opcional)](#️-narração-por-voz-opcional)
  - [✏️ Editor de guias](#️-editor-de-guias)
  - [🔊 Narração do vídeo (opcional)](#-narração-do-vídeo-opcional)
  - [📤 Exportação multi-formato](#-exportação-multi-formato)
- [🔐 Privacidade e armazenamento](#-privacidade-e-armazenamento)
- [🤝 Contribuir](#-contribuir)
- [📜 Licença](#-licença)

<br/>

</details>

## 📺 Demo

<div align="center">
<img src="https://github.com/user-attachments/assets/9de20b45-2256-4127-8242-141cf1802f39" alt="Demo do Mimik" width="800" />
</div>

## 👋 Começando

O Mimik transforma qualquer tarefa repetitiva do navegador num guia documentado e compartilhável em segundos. Roda inteiro dentro do teu navegador. Sem backend, sem conta, sem telemetria, e nada sai do teu dispositivo.

Seja documentando ferramentas internas, escrevendo tutoriais do produto, ou integrando um colega novo, o Mimik captura cada clique, tecla e navegação automaticamente pra tu focar no que importa.

Cada ação relevante vira um passo: cliques em botões e links, campos de formulário, atalhos de teclado, ações da área de transferência, arrastos e navegações. Cliques rápidos em elementos próximos são agrupados pros guias ficarem limpos, e o clique é interceptado antes da página navegar, então nada se perde em SPAs nem em carregamentos completos.

Cada passo ganha uma captura com o elemento clicado destacado e ampliado. Sem recortar na mão, sem ferramenta de anotação pra aprender.

Precisa que a gravação olhe pro outro lado por um instante? **Pausar** para a captura sem encerrar a gravação, e **Retomar** segue de onde tu parou. Entrar no Smart Blur pausa do mesmo jeito.

| Navegador | Versão | Instalação |
| --------- | ------ | ---------- |
| Chrome    | [![Chrome Version][chrome-version-shield]][chrome-link]   | [Chrome Web Store][chrome-link] |
| Firefox   | [![Firefox Version][firefox-version-shield]][firefox-link] | [Firefox Add-ons][firefox-link]  |
| Edge      | [![Edge Version][edge-version-shield]][edge-link]          | [Microsoft Edge Add-ons][edge-link] |

Disponível em inglês, espanhol, português brasileiro, francês, alemão e chinês simplificado. O idioma das descrições de IA é configurado separadamente, então tu pode usar o Mimik em inglês e gerar os guias em português, ou qualquer combinação.

> \[!IMPORTANT]
>
> **⭐️ Dá uma estrela no repo** se o Mimik te economiza tempo. Ajuda outras pessoas a descobrirem ele.

<a href="https://github.com/westpoint-io/mimik">
  <img width="100%" alt="Dê uma estrela ao Mimik no GitHub" src="https://github.com/user-attachments/assets/80d304da-a765-4bde-bf49-b1bdcb4fe804" />
</a>

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

## ✨ Funcionalidades

### 🔒 Smart Blur

O Smart Blur é um modo que tu ativa durante a gravação, não um filtro sempre ligado. Clica em **Blur** e a captura pausa, o Mimik detecta e mascara os dados sensíveis da página — e-mails, telefones, CPFs, cartões de crédito, IPs, endereços MAC — e as capturas dessa página mantêm eles escondidos depois que tu clica em **Pronto**. Liga ou desliga cada categoria do jeito que tu quiser.

Precisa esconder algo específico? O seletor manual deixa tu escolher qualquer elemento do DOM e mascarar ele em todas as capturas onde aparecer.

<details>
<summary><strong>O que o Smart Blur não alcança</strong></summary>

<br/>

O Smart Blur varre nós de texto e valores de campos no frame principal da página. Isso deixa lacunas reais, todas estruturais. Se tu depende disso para LGPD, GDPR ou algo do tipo, confere as capturas em vez de assumir que uma captura limpa é uma captura segura:

| Não coberto | Por quê |
|-------------|---------|
| Conteúdo dentro de iframes | Ignorado por completo; frames de outra origem são inalcançáveis |
| Shadow DOM | A varredura percorre o documento e não entra nos shadow roots |
| Texto pintado num `<canvas>` e texto dentro de imagens | São pixels, não texto |
| Conteúdo CSS `::before` / `::after` | Não é nó de texto |
| Texto de `<select>` e `<option>` | Excluído da varredura |
| Valores que só existem em atributos, como `title` ou `alt` | Só nós de texto e valores de campos são lidos |
| Frames que não o principal | O overlay e a varredura rodam só no frame principal |
| Qualquer aba que não a que tu ativou o modo | Só aquela aba é varrida; outra com a mesma app não |
| Texto que aparece depois do **Pronto** | A varredura para junto com o overlay, então um re-render da SPA, a próxima página de uma lista ou uma navegação ficam sem máscara — entra no Blur de novo lá |

Duas coisas que vale saber sobre o que é tratado: um casamento dentro de `<text>` de SVG é removido do render em vez de desfocado, porque a máscara é um elemento HTML que o SVG não desenha — o dado não escapa, mas desaparece em vez de desfocar. E um `<input>` ou `<textarea>` que casa é desfocado **por inteiro**, não só o trecho que casou.

O desfoque vale do momento em que tu entra no modo pra frente. Capturas feitas antes não são mascaradas retroativamente — apaga esses passos no editor.

</details>

<img src="https://github.com/user-attachments/assets/968d2518-c561-4d68-92a6-3d5f569fe38a" alt="Smart Blur" width="800" />

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

### 🧠 Descrições por IA (opcional)

Traz a tua API key (OpenAI ou Anthropic) e o Mimik gera descrições naturais tipo *"Clique no botão **Enviar** pra salvar as alterações"* ao invés de `Click button "Submit"`.

As descrições são geradas a partir de um contexto leve do DOM (~50-100 tokens), não das capturas. Umas 15-30 vezes mais barato que modelos com visão. Escolhe o idioma das descrições (inglês, espanhol, português, francês, alemão, chinês).

<img src="https://github.com/user-attachments/assets/3540cbd5-133f-46fd-a9b6-ffce9b4d422a" alt="Descrições por IA" width="800" />

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

### ▶️ Reprodução Guide Me

Reproduz qualquer guia ao vivo numa página real. O Mimik destaca o próximo elemento, marca teu progresso passo a passo, e avança sozinho conforme tu vai interagindo. Perfeito pra integrar colegas ou pra se guiar num processo tu mesmo.

<img src="https://github.com/user-attachments/assets/56ffca1d-5074-491f-8571-dd70782d4b05" alt="Reprodução Guide Me" width="800" />

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

### 🎙️ Narração por voz (opcional)

Fala em voz alta enquanto grava e o Mimik transforma o que tu disse nas descrições dos passos. O
áudio é transcrito com a tua própria key (OpenAI ou Groq) e casado com o passo a que pertence,
então tu narra uma vez em vez de escrever cada passo na mão.

<img src="https://github.com/user-attachments/assets/061fddc7-da65-4641-8b39-d30b80c36531" alt="Narração por voz" width="800" />

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

### ✏️ Editor de guias

Ajusta um guia depois sem regravar. Recorta, anota e censura qualquer captura, reescreve um passo
com IA sem sair do editor, coloca títulos e notas entre os passos, reordena ou apaga em lote, e
volta atrás pelo histórico de versões.

<img src="https://github.com/user-attachments/assets/62d3a01e-b129-44c8-8ba3-e9b97ff08d7e" alt="Editor de guias" width="800" />

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

### 🔊 Narração do vídeo (opcional)

Ative no painel de exportação e cada passo do vídeo será lido em voz alta, com sua própria chave da
OpenAI ou ElevenLabs. Se você já configurou uma chave da OpenAI para as descrições com IA, o Mimik
reaproveita — não há mais nada para assinar. Passos narrados ficam na tela até a voz terminar, então
nada é cortado, e os clipes ficam em cache local para que reexportar o mesmo guia não custe nada.

Desligada por padrão: ter uma chave nunca liga a narração; você liga.

### 📤 Exportação multi-formato

Compartilha os guias no formato que melhor cabe no teu fluxo:

- **Vídeo**: passo a passo narrado, mp4/H.264, com o cursor indo até cada alvo — opcionalmente com uma
  narração da ElevenLabs lendo cada passo, o que também deixa o vídeo adequado à Seção 508
- **PDF**: pronto pra imprimir, A4 retrato com quebras de página automáticas
- **DOCX**: abre e continua editando no Word
- **HTML**: autônomo, compartilha em qualquer lugar, imagens embutidas em base64
- **Markdown**: cola no Notion, GitHub, docs internas, wikis

Todas as exportações são geradas no cliente. Nada passa por servidor.

<img src="https://github.com/user-attachments/assets/e7584527-7d68-4f3f-9261-8380ee08dfb4" alt="Exportação multi-formato" width="800" />

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

## 🔐 Privacidade e armazenamento

Teus guias, passos e capturas ficam no teu dispositivo. Sem backend, sem conta, sem telemetria. Tuas API keys (se tu usar alguma) nunca saem do navegador. Ficam salvas localmente e são usadas pra chamar direto o provedor que tu escolheu.

Se tu está mascarando dados pessoais antes de compartilhar um guia, lê primeiro [o que o Smart Blur não alcança](#-smart-blur): ele não chega em iframes, shadow DOM nem texto desenhado dentro de imagens.

Duas coisas saem do navegador, as duas documentadas na [política de privacidade](https://mimik.westpoint.io/privacy/): os ícones dos sites são buscados no serviço de favicons do Google, o que envia o domínio daquele site, e os recursos opcionais de IA, narração por voz e narração do vídeo mandam texto ou áudio pro provedor que tu configurou — a narração do vídeo envia o texto de cada passo na hora de exportar, e só se tu ligar.

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

## 🤝 Contribuir

Todo tipo de contribuição é bem-vinda: relatos de bug, ideias novas, PRs e traduções.

Olha o [CONTRIBUTING.md](./CONTRIBUTING.md) pro setup de dev, a estrutura do projeto, e as diretrizes pra contribuidores.

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

## 📜 Licença

MIT © [Westpoint](https://github.com/westpoint-io). Olha o [LICENSE](./LICENSE) pros detalhes.

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
[local-link]: #-armazenamento-100-local

[no-account-shield]: https://img.shields.io/badge/account-not%20required-4F46E5?style=flat-square&labelColor=1E1B4B
[no-account-link]: #-armazenamento-100-local

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
