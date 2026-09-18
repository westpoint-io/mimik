<div align="center"><a name="readme-top"></a>

<img src="public/mascot.svg" width="140" height="140" alt="Mascota de Mimik" />

# Mimik

[English](./README.md) · **Español** · [Português (BR)](./README.pt-BR.md) · [Français](./README.fr.md) · [简体中文](./README.zh-CN.md)

**Captura cualquier flujo del navegador y conviértelo en una guía paso a paso. Sin cuenta, sin nube, sin rastreo.**

Le das a grabar, haces lo tuyo, y obtienes una guía pulida con capturas anotadas. Edítala, reprodúcela o expórtala.

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
<summary><kbd>Tabla de contenidos</kbd></summary>

#### TOC

- [📺 Demo](#-demo)
- [👋 Empezar](#-empezar)
- [✨ Funciones](#-funciones)
  - [🔒 Smart Blur](#-smart-blur)
  - [🧠 Descripciones con IA (opcional)](#-descripciones-con-ia-opcional)
  - [▶️ Reproducción Guide Me](#️-reproducción-guide-me)
  - [🎙️ Narración por voz (opcional)](#️-narración-por-voz-opcional)
  - [✏️ Editor de guías](#️-editor-de-guías)
  - [🔊 Voz en off del vídeo (opcional)](#-voz-en-off-del-vídeo-opcional)
  - [📤 Exportación multi-formato](#-exportación-multi-formato)
- [🔐 Privacidad y almacenamiento](#-privacidad-y-almacenamiento)
- [🤝 Contribuir](#-contribuir)
- [📜 Licencia](#-licencia)

<br/>

</details>

## 📺 Demo

<div align="center">
<img src="https://github.com/user-attachments/assets/9de20b45-2256-4127-8242-141cf1802f39" alt="Demo de Mimik" width="800" />
</div>

## 👋 Empezar

Mimik convierte cualquier tarea repetitiva del navegador en una guía documentada y compartible en segundos. Corre por completo en tu navegador. Sin backend, sin cuenta, sin telemetría, y nada sale de tu dispositivo.

Ya sea que estés documentando herramientas internas, escribiendo tutoriales de producto, o formando a un compañero, Mimik captura cada clic, tecla y navegación automáticamente para que te concentres en lo importante.

Cada acción relevante se convierte en un paso: clics en botones y enlaces, campos de formulario, atajos de teclado, acciones del portapapeles, arrastres y navegaciones. Los clics rápidos sobre elementos cercanos se agrupan para que las guías queden limpias, y el clic se intercepta antes de que la página navegue, así no se pierde nada en SPAs ni en cargas completas.

Cada paso lleva una captura con el elemento pulsado resaltado y ampliado. Sin recortar a mano, sin herramientas de anotación que aprender.

¿Necesitas que la grabación mire hacia otro lado un momento? **Pausar** detiene la captura sin terminar la grabación, y **Reanudar** sigue donde lo dejaste. Entrar en Smart Blur la pausa igual.

| Navegador | Versión | Instalación |
| --------- | ------- | ----------- |
| Chrome    | [![Chrome Version][chrome-version-shield]][chrome-link]   | [Chrome Web Store][chrome-link] |
| Firefox   | [![Firefox Version][firefox-version-shield]][firefox-link] | [Firefox Add-ons][firefox-link]  |
| Edge      | [![Edge Version][edge-version-shield]][edge-link]          | [Microsoft Edge Add-ons][edge-link] |

Disponible en inglés, español, portugués brasileño, francés, alemán y chino simplificado. El idioma de las descripciones de IA se configura por separado, así que puedes usar Mimik en inglés y generar guías en español, o cualquier combinación.

> \[!IMPORTANT]
>
> **⭐️ Dale una estrella al repo** si Mimik te ahorra tiempo. Ayuda a que otras personas lo descubran.

<a href="https://github.com/westpoint-io/mimik">
  <img width="100%" alt="Dale una estrella a Mimik en GitHub" src="https://github.com/user-attachments/assets/80d304da-a765-4bde-bf49-b1bdcb4fe804" />
</a>

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

## ✨ Funciones

### 🔒 Smart Blur

Smart Blur es un modo que activas mientras grabas, no un filtro siempre encendido. Pulsa **Blur** y la captura se pausa, Mimik detecta y enmascara los datos sensibles de la página — correos, teléfonos, números de identificación, tarjetas de crédito, IPs, direcciones MAC — y las capturas de esa página los mantienen ocultos una vez que pulsas **Listo**. Activa o desactiva cada categoría de forma independiente.

¿Necesitas ocultar algo personalizado? El selector manual te deja elegir cualquier elemento del DOM y enmascararlo en todas las capturas donde aparezca.

<details>
<summary><strong>Lo que Smart Blur no cubre</strong></summary>

<br/>

Smart Blur analiza nodos de texto y valores de campos en el marco principal de la página. Eso deja huecos reales, todos estructurales. Si dependes de esto para el RGPD o algo similar, revisa tus capturas en lugar de dar por hecho que una captura limpia es una captura segura:

| Sin cubrir | Por qué |
|------------|---------|
| Contenido dentro de iframes | Se omite por completo; los marcos de otro origen son inalcanzables |
| Shadow DOM | El análisis recorre el documento y no entra en los shadow roots |
| Texto dibujado en un `<canvas>` y texto dentro de imágenes | Son píxeles, no texto |
| Contenido CSS `::before` / `::after` | No es un nodo de texto |
| Texto de `<select>` y `<option>` | Excluido del análisis |
| Valores que solo viven en atributos, como `title` o `alt` | Solo se analizan nodos de texto y valores de campos |
| Marcos distintos del principal | El overlay y el análisis corren solo en el marco principal |
| Cualquier pestaña que no sea la que activaste | Solo se analiza esa pestaña; otra con la misma app no |
| Texto que aparece después de pulsar **Listo** | El análisis se detiene con el overlay, así que un re-render de la SPA, la página siguiente de una lista o una navegación quedan sin enmascarar — vuelve a entrar en Blur ahí |

Dos cosas que conviene saber sobre lo que sí se maneja: una coincidencia dentro de `<text>` de SVG se elimina del render en vez de difuminarse, porque la máscara es un elemento HTML que SVG no dibuja — el dato no se filtra, pero desaparece en lugar de difuminarse. Y un `<input>` o `<textarea>` que coincide se difumina **como campo completo**, no solo la parte coincidente.

El difuminado aplica desde el momento en que entras al modo. Las capturas tomadas antes no se enmascaran de forma retroactiva — borra esos pasos en el editor.

</details>

<img src="https://github.com/user-attachments/assets/968d2518-c561-4d68-92a6-3d5f569fe38a" alt="Smart Blur" width="800" />

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

### 🧠 Descripciones con IA (opcional)

Trae tu propia API key (OpenAI o Anthropic) y Mimik genera descripciones naturales como *"Haz clic en el botón **Enviar** para guardar los cambios"* en lugar de `Click button "Submit"`.

Las descripciones se generan a partir de un contexto ligero del DOM (~50-100 tokens), no desde capturas. Unas 15-30 veces más barato que los modelos con visión. Elige el idioma de las descripciones (inglés, español, portugués, francés, alemán, chino).

<img src="https://github.com/user-attachments/assets/3540cbd5-133f-46fd-a9b6-ffce9b4d422a" alt="Descripciones con IA" width="800" />

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

### ▶️ Reproducción Guide Me

Reproduce cualquier guía en vivo sobre una página real. Mimik resalta el siguiente elemento, marca tu progreso paso a paso, y avanza solo conforme vas interactuando. Ideal para formar a un compañero o para guiarte a ti mismo.

<img src="https://github.com/user-attachments/assets/56ffca1d-5074-491f-8571-dd70782d4b05" alt="Reproducción Guide Me" width="800" />

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

### 🎙️ Narración por voz (opcional)

Habla en voz alta mientras grabas y Mimik convierte lo que dijiste en las descripciones de los
pasos. El audio se transcribe con tu propia key (OpenAI o Groq) y se empareja con el paso al que
corresponde, así narras una vez en lugar de escribir cada paso a mano.

<img src="https://github.com/user-attachments/assets/061fddc7-da65-4641-8b39-d30b80c36531" alt="Narración por voz" width="800" />

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

### ✏️ Editor de guías

Arregla una guía después sin volver a grabar. Recorta, anota y censura cualquier captura, reescribe
un paso con IA sin salir del editor, mete títulos y notas entre pasos, reordena o borra en lote, y
vuelve atrás con el historial de versiones.

<img src="https://github.com/user-attachments/assets/62d3a01e-b129-44c8-8ba3-e9b97ff08d7e" alt="Editor de guías" width="800" />

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

### 🔊 Voz en off del vídeo (opcional)

Actívala en el panel de exportación y cada paso del vídeo se leerá en voz alta, con tu propia clave
de OpenAI o ElevenLabs. Si ya configuraste una clave de OpenAI para las descripciones con IA, Mimik
la reutiliza: no hay que registrarse en nada más. Los pasos narrados permanecen en pantalla hasta que
la voz termina, así que nada se corta, y los clips se guardan en caché local para que volver a
exportar la misma guía no cueste nada.

Desactivada por defecto: tener una clave nunca activa la narración; lo haces tú.

### 📤 Exportación multi-formato

Comparte tus guías en el formato que mejor encaje con tu flujo:

- **Video**: recorrido narrado, mp4/H.264, con el cursor moviéndose a cada objetivo — opcionalmente con una
  voz en off de ElevenLabs que lee cada paso, lo que además hace el vídeo apto para la Sección 508
- **PDF**: listo para imprimir, A4 vertical con saltos automáticos
- **DOCX**: ábrelo y sigue editando en Word
- **HTML**: autónomo, comparte donde sea, imágenes embebidas en base64
- **Markdown**: pega en Notion, GitHub, documentación interna, wikis

Todas las exportaciones se generan del lado del cliente. Nada pasa por un servidor.

<img src="https://github.com/user-attachments/assets/e7584527-7d68-4f3f-9261-8380ee08dfb4" alt="Exportación multi-formato" width="800" />

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

## 🔐 Privacidad y almacenamiento

Tus guías, pasos y capturas viven en tu dispositivo. No hay backend, no hay cuenta, no hay telemetría. Tus API keys (si usas alguna) nunca salen del navegador. Se guardan localmente y se usan para llamar directo al proveedor que elegiste.

Si estás enmascarando datos personales antes de compartir una guía, lee primero [lo que Smart Blur no cubre](#-smart-blur): no alcanza iframes, shadow DOM ni texto dibujado dentro de imágenes.

Dos cosas sí salen del navegador, ambas documentadas en la [política de privacidad](https://mimik.westpoint.io/privacy/): los iconos de los sitios se piden al servicio de favicons de Google, lo que envía el dominio de ese sitio, y las funciones opcionales de IA, narración por voz y voz en off mandan texto o audio al proveedor que configuraste: la voz en off envía el texto de cada paso al exportar, y solo si la activas.

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

## 🤝 Contribuir

Se agradece todo tipo de contribución: reportes de bugs, ideas nuevas, PRs y traducciones.

Mira [CONTRIBUTING.md](./CONTRIBUTING.md) para el setup de desarrollo, la estructura del proyecto, y las pautas para contribuidores.

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

## 📜 Licencia

MIT © [Westpoint](https://github.com/westpoint-io). Mira [LICENSE](./LICENSE) para los detalles.

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
[local-link]: #-almacenamiento-100-local

[no-account-shield]: https://img.shields.io/badge/account-not%20required-4F46E5?style=flat-square&labelColor=1E1B4B
[no-account-link]: #-almacenamiento-100-local

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
