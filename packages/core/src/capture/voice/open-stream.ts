const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  channelCount: 1,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

const DEVICE_ERRORS = ['OverconstrainedError', 'NotFoundError', 'NotReadableError'];

function isDeviceError(error: unknown): boolean {
  return error instanceof Error && DEVICE_ERRORS.includes(error.name);
}

export async function openStream(deviceId?: string): Promise<{ stream: MediaStream; usedFallbackDevice: boolean }> {
  if (deviceId) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { ...AUDIO_CONSTRAINTS, deviceId: { exact: deviceId } },
      });
      return { stream, usedFallbackDevice: false };
    } catch (error) {
      if (!isDeviceError(error)) throw error;
    }
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
  return { stream, usedFallbackDevice: deviceId !== undefined };
}
