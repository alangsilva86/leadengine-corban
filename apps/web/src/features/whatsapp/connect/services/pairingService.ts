export type ConnectInstanceFn = (
  instanceId: string,
  options?: { phoneNumber?: string; code?: string }
) => Promise<any>;

export async function requestPairingCode(
  connectInstance: ConnectInstanceFn,
  instanceId: string,
  phoneNumber: string
) {
  return connectInstance(instanceId, { phoneNumber });
}

export async function confirmPairingCode(
  connectInstance: ConnectInstanceFn,
  instanceId: string,
  code: string
) {
  return connectInstance(instanceId, { code });
}
