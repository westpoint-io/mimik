import { resolveByLocale } from './locale';
import type { AILanguageCode } from './prompts';

export interface PromptExamples {
  readonly steps: readonly string[];
  readonly screenSteps: readonly string[];
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
      'Review web-app Pull Requests',
      'Configure Slack Notification Preferences',
      'Submit Expense Report in Workday',
      'Create Repository in GitHub Organization',
    ],
    screenSteps: [
      'Click "Downloads" in File Explorer',
      'Select "Dark" from the Theme list',
      'Enter "Quarterly report" as the file name',
      'Press Ctrl+S to save the document',
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
      'Revisar los Pull Requests de web-app',
      'Configurar las notificaciones de Slack',
      'Enviar un informe de gastos en Workday',
      'Crear un repositorio en una organización de GitHub',
    ],
    screenSteps: [
      'Hacer clic en "Downloads" en el Explorador de archivos',
      'Seleccionar "Dark" en la lista Theme',
      'Introducir "Quarterly report" como nombre de archivo',
      'Pulsar Ctrl+S para guardar el documento',
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
      'Examiner les Pull Requests de web-app',
      'Configurer les notifications Slack',
      'Soumettre une note de frais dans Workday',
      'Créer un dépôt dans une organisation GitHub',
    ],
    screenSteps: [
      'Cliquer sur "Downloads" dans l\'Explorateur de fichiers',
      'Sélectionner "Dark" dans la liste Theme',
      'Saisir "Quarterly report" comme nom de fichier',
      'Appuyer sur Ctrl+S pour enregistrer le document',
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
      'Pull Requests von web-app prüfen',
      'Slack-Benachrichtigungen konfigurieren',
      'Spesenabrechnung in Workday einreichen',
      'Repository in GitHub-Organisation erstellen',
    ],
    screenSteps: [
      'Im Datei-Explorer auf "Downloads" klicken',
      'In der Liste Theme "Dark" auswählen',
      'Als Dateinamen "Quarterly report" eingeben',
      'Strg+S drücken, um das Dokument zu speichern',
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
      'Revisar os Pull Requests do web-app',
      'Configurar as notificações do Slack',
      'Enviar relatório de despesas no Workday',
      'Criar repositório em organização do GitHub',
    ],
    screenSteps: [
      'Clicar em "Downloads" no Explorador de Arquivos',
      'Selecionar "Dark" na lista Theme',
      'Digitar "Quarterly report" como nome do arquivo',
      'Pressionar Ctrl+S para salvar o documento',
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
      '审查 web-app 的 Pull Request',
      '配置 Slack 通知偏好',
      '在 Workday 中提交报销单',
      '在 GitHub 组织中创建仓库',
    ],
    screenSteps: [
      '在文件资源管理器中点击 "Downloads"',
      '在 Theme 列表中选择 "Dark"',
      '输入 "Quarterly report" 作为文件名',
      '按 Ctrl+S 保存文档',
    ],
    descriptions: [
      '在 Okta 管理面板中重置被锁定用户的密码。面向 IT 支持人员。',
      '配置哪些 Slack 频道发送桌面通知，并设置免打扰时间。',
    ],
  },
  ru: {
    steps: [
      'Нажать кнопку Submit',
      'Ввести адрес электронной почты в поле Email',
      'Выбрать "Admin" в раскрывающемся списке Role',
      'Перейти на страницу Settings',
    ],
    titles: [
      'Проверка Pull Request в web-app',
      'Настройка уведомлений Slack',
      'Отправка отчёта о расходах в Workday',
      'Создание репозитория в организации GitHub',
    ],
    screenSteps: [
      'Нажать "Downloads" в Проводнике',
      'Выбрать "Dark" в списке Theme',
      'Ввести "Quarterly report" в качестве имени файла',
      'Нажать Ctrl+S, чтобы сохранить документ',
    ],
    descriptions: [
      'Сброс пароля заблокированного пользователя в панели администратора Okta. Для сотрудников ИТ-поддержки.',
      'Выбор каналов Slack, которые отправляют уведомления на рабочий стол, и настройка расписания режима «Не беспокоить».',
    ],
  },
  ja: {
    steps: [
      'Submitボタンをクリック',
      'Emailフィールドにメールアドレスを入力',
      'Roleドロップダウンで「Admin」を選択',
      'Settingsページに移動',
    ],
    titles: [
      'web-appのプルリクエストをレビュー',
      'Slackの通知設定を変更',
      'Workdayで経費精算書を提出',
      'GitHubの組織にリポジトリを作成',
    ],
    screenSteps: [
      'エクスプローラーで「Downloads」をクリック',
      'Themeリストで「Dark」を選択',
      'ファイル名に「Quarterly report」を入力',
      'Ctrl+Sを押してドキュメントを保存',
    ],
    descriptions: [
      'Oktaの管理画面で、ロックされたユーザーのパスワードをリセットします。ITサポート担当者向けです。',
      'デスクトップ通知を送るSlackチャンネルを選び、通知を止める時間帯を設定します。',
    ],
  },
  ko: {
    steps: [
      'Submit 버튼 클릭',
      'Email 필드에 이메일 주소 입력',
      'Role 드롭다운에서 "Admin" 선택',
      'Settings 페이지로 이동',
    ],
    titles: [
      'web-app 풀 리퀘스트 검토',
      'Slack 알림 설정 변경',
      'Workday에서 경비 보고서 제출',
      'GitHub 조직에 저장소 만들기',
    ],
    screenSteps: [
      '파일 탐색기에서 "Downloads" 클릭',
      'Theme 목록에서 "Dark" 선택',
      '파일 이름으로 "Quarterly report" 입력',
      'Ctrl+S를 눌러 문서 저장',
    ],
    descriptions: [
      'Okta 관리자 화면에서 잠긴 사용자의 비밀번호를 재설정해요. IT 지원 담당자를 위한 가이드예요.',
      '데스크톱 알림을 보낼 Slack 채널을 고르고 방해 금지 시간을 설정해요.',
    ],
  },
  'zh-TW': {
    steps: [
      '點擊 Submit 按鈕',
      '在 Email 欄位中輸入電子郵件地址',
      '在 Role 下拉選單中選擇「Admin」',
      '前往 Settings 頁面',
    ],
    titles: [
      '審查 web-app 的 Pull Request',
      '設定 Slack 通知偏好',
      '在 Workday 中提交報帳單',
      '在 GitHub 組織中建立儲存庫',
    ],
    screenSteps: [
      '在檔案總管中點擊「Downloads」',
      '在 Theme 清單中選擇「Dark」',
      '輸入「Quarterly report」作為檔案名稱',
      '按 Ctrl+S 儲存文件',
    ],
    descriptions: [
      '在 Okta 管理介面中重設被鎖定使用者的密碼。適用於 IT 支援人員。',
      '設定哪些 Slack 頻道會傳送桌面通知，並設定勿擾時段。',
    ],
  },
};

export function resolveExamples(locale: string): PromptExamples {
  return resolveByLocale(EXAMPLES, locale) ?? EXAMPLES.en;
}

export function formatExamples(lines: readonly string[]): string {
  return lines.map((line) => `- ${line}`).join('\n');
}
