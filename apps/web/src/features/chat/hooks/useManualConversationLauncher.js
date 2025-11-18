import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api.js';
import { looksLikeWhatsAppJid } from '@/features/whatsapp/lib/instances';

const MIN_PHONE_DIGITS = 8;
const MAX_PHONE_DIGITS = 15;
const CONTACT_LOOKUP_LIMIT = 5;

const sanitizePhone = (value) => String(value ?? '').replace(/\D/g, '');

const extractDigitsFromInput = (value) => {
  if (!value) {
    return null;
  }

  if (looksLikeWhatsAppJid(value)) {
    const [localPart] = value.split('@');
    return sanitizePhone(localPart ?? '');
  }

  const digits = sanitizePhone(value);
  if (!digits) {
    return null;
  }

  return digits;
};

const toE164 = (digits) => `+${digits}`;

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
  const phone = sanitizePhone(contact.phone ?? contact.primaryPhone ?? '');
  if (phone) {
    return phone === digits;
  }
  const metadataPhone = sanitizePhone(contact.metadata?.phone ?? '');
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

const ensureContactForPhone = async (digits) => {
  const fallbackE164 = toE164(digits);
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
      const digits = extractDigitsFromInput(phone);
      const trimmedMessage = typeof message === 'string' ? message.trim() : '';
      const normalizedInstance = typeof instanceId === 'string' ? instanceId.trim() : '';

      if (!digits || digits.length < MIN_PHONE_DIGITS || digits.length > MAX_PHONE_DIGITS) {
        throw new Error('Informe um telefone válido com DDD e país.');
      }

      if (!trimmedMessage) {
        throw new Error('Digite a mensagem inicial.');
      }

      if (!normalizedInstance) {
        throw new Error('Selecione uma instância conectada.');
      }

      const { contact, phoneE164 } = await ensureContactForPhone(digits);
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
          to: phoneE164,
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
