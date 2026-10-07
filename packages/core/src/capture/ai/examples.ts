import { resolveByLocale } from './locale';
import type { AILanguageCode } from './prompts';

export interface PromptExamples {
  readonly steps: readonly string[];
  readonly titles: readonly string[];
  readonly descriptions: readonly string[];
}

const EXAMPLES: Record<AILanguageCode, PromptExamples> = {
  en: {
    steps: [
      'Click the Submit button',
      'Enter email address in the Email field',
      'Select "Admin" from the Role dropdown',
      'Navigate to the Settings page',
    ],
    titles: [
      'Review claude-code Pull Requests',
      'Configure Slack Notification Preferences',
      'Submit Expense Report in Workday',
      'Create Repository in GitHub Organization',
    ],
    descriptions: [
      "Reset a locked-out user's password from the Okta admin panel. For IT support staff.",
      'Configure which Slack channels send desktop notifications, and set a do-not-disturb schedule.',
    ],
  },
  es: {
    steps: [
      'Hacer clic en el botón Submit',
      'Introducir la dirección de correo en el campo Email',
      'Seleccionar "Admin" en el desplegable Role',
      'Ir a la página Settings',
    ],
    titles: [
      'Revisar los Pull Requests de claude-code',
      'Configurar las notificaciones de Slack',
      'Enviar un informe de gastos en Workday',
      'Crear un repositorio en una organización de GitHub',
    ],
    descriptions: [
      'Restablecer la contraseña de un usuario bloqueado desde el panel de administración de Okta. Para el personal de soporte de TI.',
      'Configurar qué canales de Slack envían notificaciones de escritorio y establecer un horario de no molestar.',
    ],
  },
  fr: {
    steps: [
      'Cliquer sur le bouton Submit',
      "Saisir l'adresse e-mail dans le champ Email",
      'Sélectionner "Admin" dans la liste déroulante Role',
      'Aller à la page Settings',
    ],
    titles: [
      'Examiner les Pull Requests de claude-code',
      'Configurer les notifications Slack',
      'Soumettre une note de frais dans Workday',
      'Créer un dépôt dans une organisation GitHub',
    ],
    descriptions: [
      "Réinitialiser le mot de passe d'un utilisateur bloqué depuis le panneau d'administration Okta. Pour le support informatique.",
      'Configurer les canaux Slack qui envoient des notifications sur le bureau et définir une plage Ne pas déranger.',
    ],
  },
  de: {
    steps: [
      'Auf die Schaltfläche Submit klicken',
      'E-Mail-Adresse in das Feld Email eingeben',
      'In der Dropdown-Liste Role "Admin" auswählen',
      'Zur Seite Settings navigieren',
    ],
    titles: [
      'Pull Requests von claude-code prüfen',
      'Slack-Benachrichtigungen konfigurieren',
      'Spesenabrechnung in Workday einreichen',
      'Repository in GitHub-Organisation erstellen',
    ],
    descriptions: [
      'Das Passwort eines gesperrten Benutzers im Okta-Adminbereich zurücksetzen. Für den IT-Support.',
      'Festlegen, welche Slack-Kanäle Desktop-Benachrichtigungen senden, und einen Bitte-nicht-stören-Zeitplan einrichten.',
    ],
  },
  'pt-BR': {
    steps: [
      'Clicar no botão Submit',
      'Digitar o endereço de e-mail no campo Email',
      'Selecionar "Admin" na lista Role',
      'Ir para a página Settings',
    ],
    titles: [
      'Revisar os Pull Requests do claude-code',
      'Configurar as notificações do Slack',
      'Enviar relatório de despesas no Workday',
      'Criar repositório em organização do GitHub',
    ],
    descriptions: [
      'Redefinir a senha de um usuário bloqueado no painel de administração do Okta. Para a equipe de suporte de TI.',
      'Configurar quais canais do Slack enviam notificações na área de trabalho e definir um horário de não perturbar.',
    ],
  },
  'zh-CN': {
    steps: [
      '点击 Submit 按钮',
      '在 Email 字段中输入邮箱地址',
      '在 Role 下拉菜单中选择 "Admin" 选项',
      '进入 Settings 页面',
    ],
    titles: [
      '审查 claude-code 的 Pull Request',
      '配置 Slack 通知偏好',
      '在 Workday 中提交报销单',
      '在 GitHub 组织中创建仓库',
    ],
    descriptions: [
      '在 Okta 管理面板中重置被锁定用户的密码。面向 IT 支持人员。',
      '配置哪些 Slack 频道发送桌面通知，并设置免打扰时间。',
    ],
  },
};

export function resolveExamples(locale: string): PromptExamples {
  return resolveByLocale(EXAMPLES, locale) ?? EXAMPLES.en;
}

export function formatExamples(lines: readonly string[]): string {
  return lines.map((line) => `- ${line}`).join('\n');
}
