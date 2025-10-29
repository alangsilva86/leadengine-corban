import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import useUpdateContactField from '../api/useUpdateContactField.js';
import useUpdateDealFields from '../api/useUpdateDealFields.js';
import useUpdateNextStep from '../api/useUpdateNextStep.js';
import {
  contactFieldUpdateSchema,
  dealFieldUpdateSchema,
  normalizeContactFieldValue,
  normalizeDealFieldValue,
  type ContactField,
  type DealField,
} from '../utils/validation.ts';

interface EntityLike {
  id?: string | null;
  [key: string]: unknown;
}

interface LeadLike extends EntityLike {
  customFields?: Record<string, unknown> | null;
}

interface TicketLike extends EntityLike {
  metadata?: Record<string, unknown> | null;
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
  const updateContactFieldMutation = useUpdateContactField({ contactId: selectedContact?.id as string | undefined });
  const updateNextStepMutation = useUpdateNextStep({ ticketId: selectedTicket?.id as string | undefined });
  const updateDealFieldsMutation = useUpdateDealFields({ leadId: selectedLead?.id as string | undefined });

  const [nextStepDraft, setNextStepDraft] = useState('');

  useEffect(() => {
    const nextStep =
      (selectedTicket?.metadata as any)?.nextAction?.description ??
      (selectedTicket?.nextStep as any)?.description ??
      '';
    setNextStepDraft(nextStep ?? '');
  }, [
    selectedTicket?.id,
    (selectedTicket?.metadata as any)?.nextAction?.description,
    (selectedTicket?.nextStep as any)?.description,
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

      const normalizedCurrent = normalizeContactFieldValue(result.data.field, selectedContact?.[result.data.field]);
      if (normalizedCurrent === result.data.value) {
        return;
      }

      await updateContactFieldMutation.mutateAsync({
        targetContactId: selectedContact.id as string,
        data: { [result.data.field]: result.data.value },
      });
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
        (selectedTicket?.metadata as any)?.nextAction?.description ??
        (selectedTicket?.nextStep as any)?.description ??
        '';

      if ((normalizedValue ?? '') === (currentDescription ?? '')) {
        return null;
      }

      if (typeof updateNextStepMutation?.mutateAsync !== 'function') {
        return null;
      }

      try {
        const metadata: Record<string, unknown> = {
          updatedFrom: 'chat-command-center',
        };

        if (currentUser?.id) {
          metadata.updatedBy = currentUser.id;
        }

        const result = await updateNextStepMutation.mutateAsync({
          targetTicketId: ticketId,
          description: normalizedValue,
          metadata,
        });

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
          ? (selectedLead.customFields as Record<string, any>).deal ?? {}
          : {};

      const normalizedCurrent = normalizeDealFieldValue(field, currentDeal?.[field]);

      if (normalizedCurrent === result.data.value) {
        return;
      }

      await updateDealFieldsMutation.mutateAsync({
        targetLeadId: selectedLead.id as string,
        data: { [field]: result.data.value },
      });
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
