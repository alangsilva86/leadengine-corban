import { formatPhoneNumber, formatTimestampLabel } from '../../lib/formatting';
import { getInstanceMetrics } from '../../lib/metrics';
import { getStatusInfo, resolveInstancePhone } from '../../lib/instances';
import type { WhatsAppInstanceViewModel } from '../useWhatsAppConnect';

const resolveInstanceId = (target: any): string | null => {
  if (!target) return null;
  if (typeof target === 'string') return target;
  if (typeof target.id === 'string' && target.id.trim().length > 0) {
    return target.id.trim();
  }
  if (target.instance && typeof target.instance.id === 'string') {
    return target.instance.id.trim();
  }
  return null;
};

const isInstanceConnected = (entry: unknown) => {
  const status = getStatusInfo(entry)?.status ?? null;
  const normalizedStatus = typeof status === 'string' ? status.toLowerCase() : null;

  return Boolean((entry as Record<string, unknown>)?.connected) ||
    normalizedStatus === 'connected' ||
    normalizedStatus === 'online' ||
    normalizedStatus === 'ready';
};

const buildInstanceViewModels = (
  instances: any[],
  currentInstance: any | null,
): WhatsAppInstanceViewModel[] => {
  return instances.map((entry, index) => {
    const statusInfo = getStatusInfo(entry);
    const metrics = getInstanceMetrics(entry);
    const phoneLabel = resolveInstancePhone(entry) ?? '';
    const formattedPhone = formatPhoneNumber(phoneLabel);
    const addressCandidate =
      (typeof entry?.address === 'string' && entry.address) ||
      (typeof entry?.jid === 'string' && entry.jid) ||
      (typeof entry?.session === 'string' && entry.session) ||
      null;
    const lastUpdated = entry?.updatedAt ?? entry?.lastSeen ?? entry?.connectedAt ?? null;
    const user = typeof entry?.user === 'string' ? entry.user : null;
    const rateUsage = metrics.rateUsage;
    const ratePercentage = Math.max(0, Math.min(100, rateUsage?.percentage ?? 0));
    const key =
      (typeof entry?.id === 'string' && entry.id) ||
      (typeof entry?.name === 'string' && entry.name) ||
      `instance-${index}`;

    return {
      key,
      id: typeof entry?.id === 'string' ? entry.id : null,
      displayName:
        (typeof entry?.name === 'string' && entry.name) ||
        (typeof entry?.id === 'string' ? entry.id : 'Instância'),
      phoneLabel,
      formattedPhone,
      addressLabel: addressCandidate && addressCandidate !== phoneLabel ? addressCandidate : null,
      statusInfo,
      metrics,
      statusValues: metrics.status,
      rateUsage,
      ratePercentage,
      lastUpdatedLabel: formatTimestampLabel(lastUpdated),
      user,
      instance: entry,
      isCurrent:
        Boolean(currentInstance?.id && entry?.id && currentInstance.id === entry.id) ||
        currentInstance === entry,
    };
  });
};

export { buildInstanceViewModels, isInstanceConnected, resolveInstanceId };
