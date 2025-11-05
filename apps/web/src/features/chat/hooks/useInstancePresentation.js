import { useMemo } from 'react';
import useWhatsAppInstances from '@/features/whatsapp/hooks/useWhatsAppInstances.jsx';

// Nota: caso a operação deseje cores/nomes fixos por instância, mantenha uma tabela
// externa (ex.: arquivo de config ou endpoint) e combine aqui antes do fallback.

const FALLBACK = {
  label: 'Instância desconhecida',
  color: '#94A3B8',
  phone: null,
  number: null,
};

const normalizeInstance = (instance) => {
  if (!instance) {
    return null;
  }

  const slug =
    typeof instance.slug === 'string' && instance.slug.trim().length > 0
      ? instance.slug.trim()
      : typeof instance.instanceId === 'string'
        ? instance.instanceId.trim()
        : instance.id;
  const color =
    typeof instance.color === 'string' && instance.color.trim().length > 0
      ? instance.color.trim()
      : instance.uiColor ?? null;

  const phoneCandidate =
    instance.phone ??
    instance.phoneNumber ??
    instance.displayPhone ??
    instance.whatsappPhone ??
    instance.metadata?.phone ??
    null;

  return {
    id: instance.id ?? slug ?? null,
    slug,
    label: instance.label ?? instance.name ?? slug ?? null,
    color,
    phone: phoneCandidate,
    number: instance.number ?? phoneCandidate ?? null,
  };
};

const buildPresentationMap = (instances) => {
  const map = new Map();
  for (const instance of instances) {
    const normalized = normalizeInstance(instance);
    if (!normalized || !normalized.id) {
      continue;
    }
    map.set(normalized.id, normalized);
    if (normalized.slug) {
      map.set(normalized.slug, normalized);
    }
  }
  return map;
};

export default function useInstancePresentation(instanceId) {
  const { instances = [] } = useWhatsAppInstances();

  const presentation = useMemo(() => {
    const map = buildPresentationMap(instances);
    if (!instanceId) {
      return FALLBACK;
    }

    const byId = map.get(instanceId);
    if (byId) {
      return {
        label: byId.label ?? byId.slug ?? instanceId,
        color: byId.color ?? FALLBACK.color,
        phone: byId.phone ?? null,
        number: byId.number ?? byId.phone ?? null,
      };
    }

    const normalizedId = String(instanceId).trim();
    const byNormalized = map.get(normalizedId);
    if (byNormalized) {
      return {
        label: byNormalized.label ?? byNormalized.slug ?? normalizedId,
        color: byNormalized.color ?? FALLBACK.color,
        phone: byNormalized.phone ?? null,
        number: byNormalized.number ?? byNormalized.phone ?? null,
      };
    }

    return {
      label: normalizedId.length > 0 ? normalizedId : FALLBACK.label,
      color: FALLBACK.color,
      phone: null,
      number: null,
    };
  }, [instanceId, instances]);

  return presentation;
}
