import { useMemo } from 'react';
import { resolvePrimaryAction, getTicketStage, getStageInfo } from '../utils/stage.js';

const useTicketStageInfo = (ticket) => {
  const stageKey = useMemo(
    () => getTicketStage(ticket),
    [ticket?.metadata?.pipelineStep, ticket?.pipelineStep, ticket?.stage],
  );

  const stageInfo = useMemo(() => getStageInfo(stageKey), [stageKey]);

  const primaryAction = useMemo(() => {
    if (!ticket) {
      return null;
    }

    const hasPhone = Boolean(
      ticket?.contact?.phone ??
        (Array.isArray(ticket?.contact?.phones) && ticket.contact.phones.length > 0) ??
        ticket?.metadata?.contactPhone,
    );

    const whatsappChannel =
      ticket?.metadata?.channels?.whatsapp ??
      ticket?.channels?.whatsapp ??
      null;

    const whatsappIsInvalid =
      (typeof whatsappChannel?.valid === 'boolean' && whatsappChannel.valid === false) ||
      (typeof whatsappChannel?.isValid === 'boolean' && whatsappChannel.isValid === false) ||
      whatsappChannel === false ||
      whatsappChannel?.status === 'invalid';

    const leadHasWhatsApp = hasPhone && !whatsappIsInvalid;
    const needsContactValidation = hasPhone && whatsappIsInvalid;

    return resolvePrimaryAction({
      stageKey,
      hasWhatsApp: leadHasWhatsApp,
      needsContactValidation,
    });
  }, [
    stageKey,
    ticket?.channels?.whatsapp,
    ticket?.channels?.whatsapp?.isValid,
    ticket?.channels?.whatsapp?.status,
    ticket?.channels?.whatsapp?.valid,
    ticket?.contact?.phone,
    ticket?.contact?.phones,
    ticket?.metadata?.channels?.whatsapp,
    ticket?.metadata?.channels?.whatsapp?.isValid,
    ticket?.metadata?.channels?.whatsapp?.status,
    ticket?.metadata?.channels?.whatsapp?.valid,
    ticket?.metadata?.contactPhone,
  ]);

  return { stageKey, stageInfo, primaryAction };
};

export default useTicketStageInfo;
