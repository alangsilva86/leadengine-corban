import type { WhatsAppInstanceViewModel } from '../useWhatsAppConnect';
declare const resolveInstanceId: (target: any) => string | null;
declare const isInstanceConnected: (entry: unknown) => boolean;
declare const buildInstanceViewModels: (instances: any[], currentInstance: any | null) => WhatsAppInstanceViewModel[];
declare const resolveInstanceLabel: (instance: any) => string;
declare const sortInstancesByLabel: <T>(instances: T[]) => T[];
export { buildInstanceViewModels, isInstanceConnected, resolveInstanceId, resolveInstanceLabel, sortInstancesByLabel, };
