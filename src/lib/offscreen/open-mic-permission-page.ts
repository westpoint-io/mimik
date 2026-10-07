import { createTab } from '../browser-api/create-tab';
import { getExtensionURL } from '../browser-api/get-extension-url';
import { localVoiceHost } from '../voice/local-voice-host';
import { IS_FIREFOX } from './constants';
import { promptForMicrophone } from './prompt-for-microphone';

const MIC_PERMISSION_PATH = '/mic-permission.html';

export function openMicPermissionPage(tabId?: number): Promise<unknown> {
  if (IS_FIREFOX) {
    if (localVoiceHost.current === null) return Promise.resolve(undefined);
    return promptForMicrophone();
  }
  const url = getExtensionURL(tabId === undefined ? MIC_PERMISSION_PATH : `${MIC_PERMISSION_PATH}?tabId=${tabId}`);
  return createTab({ url, active: true });
}
