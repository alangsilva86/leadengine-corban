import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api.js';
import { extractPhoneDigits, normalizePhoneE164, PHONE_MAX_DIGITS, PHONE_MIN_DIGITS } from '@ticketz/shared';

const MIN_PHONE_DIGITS = PHONE_MIN_DIGITS;
const CONTACT_LOOKUP_LIMIT = 5;

const normalizePhonePayload = (value) => {
  const phoneE164 = normalizePhoneE164(value, { minDigits: MIN_PHONE_DIGITS, maxDigits: PHONE_MAX_DIGITS });
  if (!phoneE164) {
    return null;
  }

  const digits = extractPhoneDigits(phoneE164);
  if (!digits) {
    return null;
  }

  return { digits, phoneE164 };
};

const generateIdempotencyKey = () => {
  const rand = Math.random().toString(36).slice(2, 10);
  return `manual-${Date.now().toString(36)}-${rand}`;
};

const extractContactsFromResponse = (payload) => {
  if (Array.isArray(payload?.data?.items)) {
    return payload.data.items;
  }
  if (Array.isArray(payload?.items)) {
    return payload.items;
  }
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  if (Array.isArray(payload)) {
    return payload;
  }
  return [];
};

const matchesPhoneDigits = (contact, digits) => {
  if (!contact) {
    return false;
  }
  const phone = extractPhoneDigits(contact.phone ?? contact.primaryPhone ?? null);
  if (phone) {
    return phone === digits;
  }
  const metadataPhone = extractPhoneDigits(contact.metadata?.phone ?? null);
  return metadataPhone === digits;
};

const findContactByPhone = async (digits) => {
  if (!digits) {
    return null;
  }

  const searchTerms = [digits, `+${digits}`];
  for (const term of searchTerms) {
    const params = new URLSearchParams({ limit: String(CONTACT_LOOKUP_LIMIT), search: term });
    const response = await apiGet(`/api/contacts?${params.toString()}`);
    const items = extractContactsFromResponse(response);
    const match = items.find((item) => matchesPhoneDigits(item, digits));
    if (match) {
      return match;
    }
  }

  return null;
};

const ensureContactForPhone = async ({ digits, phoneE164 }) => {
  const fallbackE164 = phoneE164 ?? normalizePhoneE164(digits, { minDigits: MIN_PHONE_DIGITS, maxDigits: PHONE_MAX_DIGITS });
  if (!fallbackE164) {
    throw new Error('Informe um telefone válido com DDD e país.');
  }
  const existing = await findContactByPhone(digits);
  if (existing?.id) {
    const contactPhone = typeof existing.phone === 'string' && existing.phone.trim().length > 0 ? existing.phone : fallbackE164;
    const normalizedPhone = contactPhone.startsWith('+') ? contactPhone : fallbackE164;
    return { contact: existing, phoneE164: normalizedPhone };
  }

  try {
    const response = await apiPost('/api/contacts', {
      name: fallbackE164,
      phone: fallbackE164,
    });
    const contact = response?.data ?? response ?? null;
    if (contact?.id) {
      return { contact, phoneE164: fallbackE164 };
    }
  } catch (error) {
    if (error?.status === 409) {
      const retry = await findContactByPhone(digits);
      if (retry?.id) {
        const normalizedPhone =
          typeof retry.phone === 'string' && retry.phone.trim().length > 0 ? retry.phone : fallbackE164;
        return { contact: retry, phoneE164: normalizedPhone.startsWith('+') ? normalizedPhone : fallbackE164 };
      }
    }
    throw error;
  }

  throw new Error('Não foi possível preparar o contato para envio manual.');
};

export const useManualConversationLauncher = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationKey: ['lead-inbox', 'manual-conversation'],
    mutationFn: async ({ phone, message, instanceId }) => {
      const normalizedPhone = normalizePhonePayload(phone);
      const trimmedMessage = typeof message === 'string' ? message.trim() : '';
      const normalizedInstance = typeof instanceId === 'string' ? instanceId.trim() : '';

      if (!normalizedPhone) {
        throw new Error('Informe um telefone válido com DDD e país.');
      }

      const { digits, phoneE164 } = normalizedPhone;

      if (!trimmedMessage) {
        throw new Error('Digite a mensagem inicial.');
      }

      if (!normalizedInstance) {
        throw new Error('Selecione uma instância conectada.');
      }

      const { contact, phoneE164: resolvedPhone } = await ensureContactForPhone({ digits, phoneE164 });
      if (!contact?.id) {
        throw new Error('Não foi possível localizar o contato para o envio manual.');
      }

      const idempotencyKey = generateIdempotencyKey();
      const outboundResponse = await apiPost(
        `/api/contacts/${contact.id}/messages`,
        {
          payload: {
            type: 'text',
            text: trimmedMessage,
          },
          idempotencyKey,
          to: resolvedPhone,
          instanceId: normalizedInstance,
        },
        {
          headers: {
            'Idempotency-Key': idempotencyKey,
          },
        }
      );

      const normalizedResponse = outboundResponse ?? null;

      return {
        contact,
        contactId: contact.id ?? null,
        ticket: null,
        ticketId: normalizedResponse?.ticketId ?? null,
        message: null,
        messageId: normalizedResponse?.messageId ?? null,
        outboundResponse: normalizedResponse,
        raw: normalizedResponse,
      };
    },
    onSuccess: (result) => {
      if (result?.ticketId) {
        queryClient.invalidateQueries({
          queryKey: ['chat', 'messages', result.ticketId],
        });
      }
      queryClient.invalidateQueries({ queryKey: ['chat', 'tickets'] });
    },
  });

  return {
    launch: (payload) => mutation.mutateAsync(payload),
    isPending: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
    isAvailable: true,
    unavailableReason: null,
  };
};

export default useManualConversationLauncher;
