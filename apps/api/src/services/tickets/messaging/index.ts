import { createWhatsAppSendModule, rateKeyForInstance, resolveInstanceRateLimit, getDefaultQueueIdForTenant } from '../whatsapp-send';
import { sendMessage, emitMessageUpdatedEvents } from './send-message';
import { resolveWhatsAppInstanceId, normalizeBrokerStatus } from '../shared/whatsapp';
import { createTicket } from '../mutations/lifecycle';
import { OPEN_STATUSES } from '../constants';

const whatsappSendModule = createWhatsAppSendModule({
  sendMessage,
  resolveWhatsAppInstanceId,
  createTicket,
  openStatuses: OPEN_STATUSES,
});

export const sendOnTicket = whatsappSendModule.sendOnTicket;
export const sendToContact = whatsappSendModule.sendToContact;
export const sendAdHoc = whatsappSendModule.sendAdHoc;

export { sendMessage, emitMessageUpdatedEvents, normalizeBrokerStatus } from './send-message';
export { rateKeyForInstance, resolveInstanceRateLimit, getDefaultQueueIdForTenant };
export type { WhatsAppTransportDependencies } from '../whatsapp-send';
