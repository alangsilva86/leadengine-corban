export type ConnectInstanceFn = (instanceId: string, options?: {
    phoneNumber?: string;
    code?: string;
}) => Promise<any>;
export declare function requestPairingCode(connectInstance: ConnectInstanceFn, instanceId: string, phoneNumber: string): Promise<any>;
export declare function confirmPairingCode(connectInstance: ConnectInstanceFn, instanceId: string, code: string): Promise<any>;
