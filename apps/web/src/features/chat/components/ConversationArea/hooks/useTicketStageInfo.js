import { useMemo } from 'react';
import { resolvePrimaryAction, getTicketStage, getStageInfo } from '../utils/stage.js';

const useTicketStageInfo = (ticket) => {
  const stageKey = useMemo(
    () => getTicketStage(ticket),
    [ticket?.metadata?.pipelineStep, ticket?.pipelineStep, ticket?.stage],
  );

  const stageInfo = useMemo(() => getStageInfo(stageKey), [stageKey]);

  const salesState = useMemo(() => {
    if (!Array.isArray(ticket?.salesTimeline)) {
      return { hasSimulation: false, hasProposal: false, hasDeal: false };
    }

    let hasSimulation = false;
    let hasProposal = false;
    let hasDeal = false;

    ticket.salesTimeline.forEach((event) => {
      const type = typeof event?.type === 'string' ? event.type.split('.')[0] : '';
      if (type === 'simulation') {
        hasSimulation = true;
      }
      if (type === 'proposal') {
        hasProposal = true;
      }
      if (type === 'deal') {
        hasDeal = true;
      }
    });

    return { hasSimulation, hasProposal, hasDeal };
  }, [ticket?.salesTimeline]);

  const primaryAction = useMemo(() => {
    if (!ticket) {
      return null;
    }

    if (salesState.hasDeal) {
      return { id: 'sales-done', label: 'Contrato concluído', disabled: true };
    }

    if (salesState.hasProposal) {
      return { id: 'sales-deal', label: 'Registrar negócio' };
    }

    if (salesState.hasSimulation) {
      return { id: 'sales-proposal', label: 'Gerar proposta' };
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
    salesState.hasDeal,
    salesState.hasProposal,
    salesState.hasSimulation,
  ]);

  return { stageKey, stageInfo, primaryAction };
};

export default useTicketStageInfo;
