const MICROPHONE: PermissionDescriptor = { name: 'microphone' as PermissionName };

export async function microphoneGranted(): Promise<boolean> {
  try {
    const status = await navigator.permissions.query(MICROPHONE);
    return status.state === 'granted';
  } catch {
    return false;
  }
}
