export interface MicrophoneOption {
  deviceId: string;
  label: string;
}

export type MicrophoneDevice = Pick<MediaDeviceInfo, 'kind' | 'deviceId' | 'label'>;
