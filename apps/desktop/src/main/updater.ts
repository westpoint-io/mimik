import { app, dialog } from 'electron';
import electronUpdater from 'electron-updater';
import { mainI18n } from './i18n';

const { autoUpdater } = electronUpdater;

let wired = false;
let manual = false;

export function checkForUpdates(opts: { notifyWhenUpToDate: boolean }): void {
  if (!app.isPackaged) return;
  manual = opts.notifyWhenUpToDate;

  if (!wired) {
    wired = true;
    autoUpdater.autoDownload = true;
    autoUpdater.on('update-downloaded', async (info) => {
      const { response } = await dialog.showMessageBox({
        type: 'info',
        buttons: [mainI18n.t('desktop.restartNow'), mainI18n.t('desktop.later')],
        defaultId: 0,
        cancelId: 1,
        title: mainI18n.t('desktop.updateReady'),
        message: mainI18n.t('desktop.updateReadyMessage', [info.version]),
      });
      if (response === 0) autoUpdater.quitAndInstall();
    });
    autoUpdater.on('error', (err) => {
      if (manual) {
        console.error('update check failed', err);
        dialog.showMessageBox({
          type: 'error',
          title: mainI18n.t('desktop.updateFailed'),
          message: mainI18n.t('desktop.updateFailed'),
          detail: mainI18n.t('desktop.updateFailedMessage'),
        });
      }
    });
  }

  autoUpdater
    .checkForUpdates()
    .then((result) => {
      if (opts.notifyWhenUpToDate && result?.isUpdateAvailable === false) {
        dialog.showMessageBox({
          type: 'info',
          title: mainI18n.t('desktop.upToDate'),
          message: mainI18n.t('desktop.upToDateMessage', [app.getVersion()]),
        });
      }
    })
    .catch(() => {});
}
