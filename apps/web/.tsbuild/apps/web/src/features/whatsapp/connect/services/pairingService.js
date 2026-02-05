export async function requestPairingCode(connectInstance, instanceId, phoneNumber) {
    return connectInstance(instanceId, { phoneNumber });
}
export async function confirmPairingCode(connectInstance, instanceId, code) {
    return connectInstance(instanceId, { code });
}
