import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import useUpdateContactField, {
  type UpdateContactFieldVariables,
} from '../api/useUpdateContactField';
import useUpdateDealFields, {
  type UpdateDealFieldsVariables,
} from '../api/useUpdateDealFields.js';
import useUpdateNextStep, {
  type UpdateNextStepMetadata,
  type UpdateNextStepVariables,
} from '../api/useUpdateNextStep.js';
import {
  contactFieldUpdateSchema,
  dealFieldUpdateSchema,
  normalizeContactFieldValue,
  normalizeDealFieldValue,
  type ContactField,
  type DealField,
} from '../utils/validation';

interface EntityLike {
  id?: string | null;
  [key: string]: unknown;
}

interface LeadLike extends EntityLike {
  customFields?: { deal?: Record<string, unknown> | null } | null;
}

interface TicketMetadata {
  nextAction?: { description?: string | null } | null;
  [key: string]: unknown;
}

interface TicketLike extends EntityLike {
  metadata?: TicketMetadata | null;
  nextStep?: { description?: string | null } | null;
}

interface ChatControllerLike {
  selectedTicketId?: string | null;
}

interface UseTicketFieldUpdatersInput {
  controller: ChatControllerLike;
  selectedTicket?: TicketLike | null;
  selectedContact?: EntityLike | null;
  selectedLead?: LeadLike | null;
  currentUser?: { id?: string | null } | null;
}

const CONTACT_FIELD_LABELS: Record<ContactField, string> = {
  name: 'nome',
  document: 'documento',
  email: 'e-mail',
  phone: 'telefone',
};

const DEAL_FIELD_LABELS: Record<DealField, string> = {
  installmentValue: 'valor da parcela',
  netValue: 'valor líquido',
  term: 'prazo',
  product: 'produto',
  bank: 'banco',
};

export const useTicketFieldUpdaters = ({
  controller,
  selectedTicket,
  selectedContact,
  selectedLead,
  currentUser,
}: UseTicketFieldUpdatersInput) => {
  const contactId = selectedContact?.id ?? null;
  const ticketIdFromSelection = selectedTicket?.id ?? null;
  const leadId = selectedLead?.id ?? null;

  const updateContactFieldMutation = useUpdateContactField(
    contactId ? { contactId } : undefined
  );
  const updateNextStepMutation = useUpdateNextStep(
    ticketIdFromSelection ? { ticketId: ticketIdFromSelection } : undefined
  );
  const updateDealFieldsMutation = useUpdateDealFields(
    leadId ? { leadId } : undefined
  );

  const [nextStepDraft, setNextStepDraft] = useState('');

  useEffect(() => {
    const nextStep =
      selectedTicket?.metadata?.nextAction?.description ??
      selectedTicket?.nextStep?.description ??
      '';
    setNextStepDraft(nextStep ?? '');
  }, [
    selectedTicket?.id,
    selectedTicket?.metadata?.nextAction?.description,
    selectedTicket?.nextStep?.description,
  ]);

  const ticketId = useMemo(() => selectedTicket?.id ?? controller.selectedTicketId ?? null, [
    controller.selectedTicketId,
    selectedTicket?.id,
  ]);

  const handleContactFieldSave = useCallback(
    async (field: ContactField, rawValue: unknown) => {
      if (!selectedContact?.id) {
        throw new Error('Contato indisponível para atualização.');
      }

      const result = contactFieldUpdateSchema.safeParse({ field, value: rawValue });

      if (!result.success) {
        toast.error('Não foi possível atualizar o contato', {
          description: `Revise o valor informado para ${CONTACT_FIELD_LABELS[field]}.`,
        });
        throw result.error;
      }

      const normalizedCurrent = normalizeContactFieldValue(
        result.data.field,
        selectedContact?.[result.data.field],
      );
      if (normalizedCurrent === result.data.value) {
        return;
      }

      const contactId = selectedContact.id;
      if (!contactId) {
        throw new Error('Contato indisponível para atualização.');
      }

      const payload: UpdateContactFieldVariables = {
        targetContactId: contactId,
        data: { [result.data.field]: result.data.value },
      };

      await updateContactFieldMutation.mutateAsync(payload);
    },
    [selectedContact?.id, selectedContact, updateContactFieldMutation]
  );

  const handleUpdateNextStep = useCallback(
    async (value: unknown) => {
      const nextValue = typeof value === 'string' ? value : String(value ?? '');
      setNextStepDraft(nextValue);

      if (!ticketId) {
        const error = new Error('Ticket indisponível para atualização.');
        toast.error('Não foi possível atualizar o próximo passo', {
          description: error.message,
        });
        throw error;
      }

      const normalizedValue = nextValue.trim();
      const currentDescription =
        selectedTicket?.metadata?.nextAction?.description ??
        selectedTicket?.nextStep?.description ??
        '';

      if ((normalizedValue ?? '') === (currentDescription ?? '')) {
        return null;
      }

      if (typeof updateNextStepMutation?.mutateAsync !== 'function') {
        return null;
      }

      try {
        const metadata: UpdateNextStepMetadata = {
          updatedFrom: 'chat-command-center',
        };

        if (currentUser?.id) {
          metadata.updatedBy = currentUser.id;
        }

        const payload: UpdateNextStepVariables = {
          targetTicketId: ticketId,
          description: normalizedValue,
          metadata,
        };

        const result = await updateNextStepMutation.mutateAsync(payload);

        toast.success('Próximo passo atualizado.');

        return result;
      } catch (error) {
        const description = error instanceof Error ? error.message : 'Tente novamente mais tarde.';
        toast.error('Não foi possível atualizar o próximo passo', { description });
        throw error;
      }
    },
    [currentUser?.id, selectedTicket, ticketId, updateNextStepMutation]
  );

  const handleDealFieldSave = useCallback(
    async (field: DealField, rawValue: unknown) => {
      if (!selectedLead?.id) {
        throw new Error('Lead indisponível para atualização.');
      }

      const result = dealFieldUpdateSchema.safeParse({ field, value: rawValue });

      if (!result.success) {
        toast.error('Não foi possível atualizar o lead', {
          description: `Revise o valor informado para ${DEAL_FIELD_LABELS[field]}.`,
        });
        throw result.error;
      }

      const currentDeal =
        selectedLead?.customFields && typeof selectedLead.customFields === 'object'
          ? selectedLead.customFields.deal ?? {}
          : {};

      const normalizedCurrent = normalizeDealFieldValue(field, currentDeal?.[field]);

      if (normalizedCurrent === result.data.value) {
        return;
      }

      const leadId = selectedLead.id;
      if (!leadId) {
        throw new Error('Lead indisponível para atualização.');
      }

      const payload: UpdateDealFieldsVariables = {
        targetLeadId: leadId,
        data: { [field]: result.data.value },
      };

      await updateDealFieldsMutation.mutateAsync(payload);
    },
    [selectedLead?.id, selectedLead, updateDealFieldsMutation]
  );

  return {
    onContactFieldSave: handleContactFieldSave,
    onDealFieldSave: handleDealFieldSave,
    onNextStepSave: handleUpdateNextStep,
    nextStepValue: nextStepDraft,
  } as const;
};

export type UseTicketFieldUpdatersReturn = ReturnType<typeof useTicketFieldUpdaters>;

export default useTicketFieldUpdaters;
