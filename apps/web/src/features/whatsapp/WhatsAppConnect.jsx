import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog.jsx';
import {
  QrCode,
  CheckCircle2,
  Link2,
  ArrowLeft,
  RefreshCcw,
  Clock,
  AlertCircle,
  Loader2,
  Trash2,
  ChevronDown,
  History,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils.js';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api.js';
import { getAuthToken, onAuthTokenChange } from '@/lib/auth.js';
import { parseRetryAfterMs } from '@/lib/rate-limit.js';
import DemoAuthDialog from '@/components/DemoAuthDialog.jsx';
import { toDataURL as generateQrDataUrl } from 'qrcode';
import usePlayfulLogger from '../shared/usePlayfulLogger.js';
import sessionStorageAvailable from '@/lib/session-storage.js';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible.jsx';
import useInstanceLiveUpdates from './hooks/useInstanceLiveUpdates.js';
import NoticeBanner from '@/components/ui/notice-banner.jsx';
import CampaignsPanel from './components/CampaignsPanel.jsx';
import CreateCampaignDialog from './components/CreateCampaignDialog.jsx';
import CreateInstanceDialog from './components/CreateInstanceDialog.jsx';
import ReassignCampaignDialog from './components/ReassignCampaignDialog.jsx';
import { toast } from 'sonner';
import { resolveWhatsAppErrorCopy } from './utils/whatsapp-error-codes.js';

const getInstancesCacheKey = (agreementId) =>
  agreementId ? `leadengine:whatsapp:instances:${agreementId}` : null;

const readInstancesCache = (agreementId) => {
  const key = getInstancesCacheKey(agreementId);
  if (!key || !sessionStorageAvailable()) {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('Não foi possível ler o cache de instâncias WhatsApp', error);
    return null;
  }
};

const persistInstancesCache = (agreementId, list, currentId) => {
  const key = getInstancesCacheKey(agreementId);
  if (!key || !sessionStorageAvailable()) {
    return;
  }
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({
        list,
        currentId,
        updatedAt: Date.now(),
      })
    );
  } catch (error) {
    console.warn('Não foi possível armazenar o cache de instâncias WhatsApp', error);
  }
};

const clearInstancesCache = (agreementId) => {
  const key = getInstancesCacheKey(agreementId);
  if (!key || !sessionStorageAvailable()) {
    return;
  }
  sessionStorage.removeItem(key);
};
import CampaignHistoryDialog from './components/CampaignHistoryDialog.jsx';

const statusCopy = {
  disconnected: {
    badge: 'Pendente',
    description: 'Leia o QR Code no WhatsApp Web para conectar seu número e começar a receber leads.',
    tone: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
  },
  connecting: {
    badge: 'Conectando',
    description: 'Estamos sincronizando com o seu número. Mantenha o WhatsApp aberto até concluir.',
    tone: 'border-sky-500/40 bg-sky-500/15 text-sky-200',
  },
  connected: {
    badge: 'Ativo',
    description: 'Pronto! Todos os leads qualificados serão entregues diretamente no seu WhatsApp.',
    tone: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
  },
  qr_required: {
    badge: 'QR necessário',
    description: 'Gere um novo QR Code e escaneie para reativar a sessão.',
    tone: 'border-purple-500/40 bg-purple-500/15 text-purple-200',
  },
};

const statusCodeMeta = [
  { code: '1', label: 'Status 1', description: 'Total de mensagens reportadas com status 1 pelo broker.' },
  { code: '2', label: 'Status 2', description: 'Total de mensagens reportadas com status 2 pelo broker.' },
  { code: '3', label: 'Status 3', description: 'Total de mensagens reportadas com status 3 pelo broker.' },
  { code: '4', label: 'Status 4', description: 'Total de mensagens reportadas com status 4 pelo broker.' },
  { code: '5', label: 'Status 5', description: 'Total de mensagens reportadas com status 5 pelo broker.' },
];

const DEFAULT_POLL_INTERVAL_MS = 15000;
const RATE_LIMIT_COOLDOWN_MS = 60 * 1000;

const normalizeKeyName = (value) => `${value}`.toLowerCase().replace(/[^a-z0-9]/g, '');

const pickMetric = (source, keys) => {
  if (!source) return undefined;

  const normalizedTargets = keys.map(normalizeKeyName);
  const visited = new Set();
  const stack = Array.isArray(source) ? [...source] : [source];

  const inspectNested = (value) => {
    return pickMetric(value, ['total', 'value', 'count', 'quantity']);
  };

  while (stack.length > 0) {
    const current = stack.pop();
    if (current === null || current === undefined) {
      continue;
    }

    if (typeof current !== 'object') {
      const direct = toNumber(current);
      if (direct !== null) {
        return direct;
      }
      continue;
    }

    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    if (Array.isArray(current)) {
      for (const entry of current) {
        stack.push(entry);
      }
      continue;
    }

    for (const [propKey, propValue] of Object.entries(current)) {
      const hasExactMatch = keys.includes(propKey);
      const normalizedKey = normalizeKeyName(propKey);
      const fuzzyMatch = normalizedTargets.some((target) =>
        target.length > 0 && normalizedKey.includes(target)
      );

      if (hasExactMatch || fuzzyMatch) {
        const numeric = toNumber(propValue);
        if (numeric !== null) {
          return numeric;
        }
        if (propValue && typeof propValue === 'object') {
          const nested = inspectNested(propValue);
          if (nested !== undefined) {
            return nested;
          }
        }
      }

      if (propValue && typeof propValue === 'object') {
        stack.push(propValue);
      }
    }
  }

  return undefined;
};

const toNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
      return numeric;
    }
  }

  return null;
};

const findStatusCountsSource = (source) => {
  if (!source) {
    return undefined;
  }

  const keywords = [
    'statuscounts',
    'statuscount',
    'statusmap',
    'statusmetrics',
    'statuses',
    'bystatus',
    'messagestatuscounts',
    'messagesstatuscounts',
    'status',
  ];
  const keySet = new Set(['1', '2', '3', '4', '5']);

  const visited = new Set();
  const queue = Array.isArray(source) ? [...source] : [source];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') {
      continue;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    if (Array.isArray(current)) {
      if (current.length && current.every((value) => typeof value === 'number')) {
        return current;
      }
      for (const entry of current) {
        queue.push(entry);
      }
      continue;
    }

    const record = current;
    const numericKeys = Object.keys(record).filter((key) => keySet.has(key));
    if (numericKeys.length >= 3) {
      return record;
    }

    for (const [propKey, propValue] of Object.entries(record)) {
      const normalizedKey = normalizeKeyName(propKey);
      if (keywords.some((keyword) => normalizedKey.includes(keyword))) {
        if (propValue && typeof propValue === 'object') {
          return propValue;
        }
      }
      if (propValue && typeof propValue === 'object') {
        queue.push(propValue);
      }
    }
  }

  return undefined;
};

const normalizeStatusCounts = (rawCounts) => {
  const defaultKeys = ['1', '2', '3', '4', '5'];
  const normalized = {};

  if (Array.isArray(rawCounts)) {
    rawCounts.forEach((value, index) => {
      const numeric = toNumber(value);
      if (numeric !== null) {
        normalized[String(index + 1)] = numeric;
      }
    });
  } else if (rawCounts && typeof rawCounts === 'object') {
    for (const [key, value] of Object.entries(rawCounts)) {
      const numeric = toNumber(value);
      if (numeric === null) continue;
      const keyMatch = `${key}`.match(/\d+/);
      const normalizedKey = keyMatch ? keyMatch[0] : `${key}`;
      normalized[normalizedKey] = numeric;
    }
  }

  return defaultKeys.reduce((acc, key, index) => {
    const fallbackKeys = [key, String(index), String(index + 1), `status_${key}`, `status${key}`];
    const value = fallbackKeys.reduce((current, candidate) => {
      if (current !== undefined) return current;
      if (Object.prototype.hasOwnProperty.call(normalized, candidate)) {
        return normalized[candidate];
      }
      return undefined;
    }, undefined);

    acc[key] = typeof value === 'number' ? value : 0;
    return acc;
  }, {});
};

const findRateSource = (source) => {
  if (!source) {
    return undefined;
  }

  const keywords = ['rateusage', 'ratelimit', 'ratelimiter', 'rate', 'throttle', 'quota'];
  const visited = new Set();
  const queue = Array.isArray(source) ? [...source] : [source];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') {
      continue;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    if (Array.isArray(current)) {
      for (const entry of current) {
        queue.push(entry);
      }
      continue;
    }

    for (const [propKey, propValue] of Object.entries(current)) {
      const normalizedKey = normalizeKeyName(propKey);
      if (keywords.some((keyword) => normalizedKey.includes(keyword))) {
        if (propValue && typeof propValue === 'object') {
          return propValue;
        }
      }
      if (propValue && typeof propValue === 'object') {
        queue.push(propValue);
      }
    }
  }

  return undefined;
};

const normalizeRateUsage = (rawRate) => {
  const defaults = {
    used: 0,
    limit: 0,
    remaining: 0,
    percentage: 0,
  };

  if (!rawRate || typeof rawRate !== 'object') {
    return defaults;
  }

  const usedCandidate = toNumber(
    pickMetric(rawRate, ['usage', 'used', 'current', 'value', 'count', 'consumed'])
  );
  const limitCandidate = toNumber(pickMetric(rawRate, ['limit', 'max', 'maximum', 'quota', 'total', 'capacity']));
  const remainingCandidate = toNumber(
    pickMetric(rawRate, ['remaining', 'left', 'available', 'saldo', 'restante'])
  );

  let used = usedCandidate !== null ? usedCandidate : null;
  const limit = limitCandidate !== null ? limitCandidate : null;
  let remaining = remainingCandidate !== null ? remainingCandidate : null;

  if (used === null && remaining !== null && limit !== null) {
    used = limit - remaining;
  }

  if (remaining === null && limit !== null && used !== null) {
    remaining = limit - used;
  }

  used = typeof used === 'number' && Number.isFinite(used) ? Math.max(0, used) : 0;
  const safeLimit = typeof limit === 'number' && Number.isFinite(limit) ? Math.max(0, limit) : 0;
  remaining = typeof remaining === 'number' && Number.isFinite(remaining) ? Math.max(0, remaining) : safeLimit ? Math.max(safeLimit - used, 0) : 0;

  const percentage = safeLimit > 0 ? Math.min(100, Math.max(0, Math.round((used / safeLimit) * 100))) : used > 0 ? 100 : 0;

  return {
    used,
    limit: safeLimit,
    remaining,
    percentage,
  };
};

const mergeMetricsSources = (...sources) => {
  return sources.reduce((acc, source) => {
    if (source && typeof source === 'object' && !Array.isArray(source)) {
      return { ...acc, ...source };
    }
    return acc;
  }, {});
};

const getInstanceMetrics = (instance) => {
  const metricsSource = mergeMetricsSources(
    instance?.metrics,
    instance?.stats,
    instance?.messages,
    instance?.rawStatus,
    instance
  );
  const sent = pickMetric(metricsSource, ['messagesSent', 'sent', 'totalSent', 'enviadas', 'messages']) ?? 0;
  const queued = pickMetric(metricsSource, ['queued', 'pending', 'fila', 'queueSize', 'waiting']) ?? 0;
  const failed = pickMetric(metricsSource, ['failed', 'errors', 'falhas', 'errorCount']) ?? 0;
  const statusCountsSource =
    findStatusCountsSource(metricsSource) ||
    findStatusCountsSource(metricsSource?.status) ||
    findStatusCountsSource(metricsSource?.messages) ||
    findStatusCountsSource(instance?.statusMetrics);
  const status = normalizeStatusCounts(statusCountsSource);
  const rateUsage = normalizeRateUsage(
    findRateSource(metricsSource) ||
      findRateSource(instance?.rate) ||
      findRateSource(instance?.rawStatus) ||
      findRateSource(instance)
  );

  return { sent, queued, failed, status, rateUsage };
};

const getStatusInfo = (instance) => {
  const rawStatus = instance?.status || (instance?.connected ? 'connected' : 'disconnected');
  const map = {
    connected: { label: 'Conectado', variant: 'success' },
    connecting: { label: 'Conectando', variant: 'info' },
    disconnected: { label: 'Desconectado', variant: 'secondary' },
    qr_required: { label: 'QR necessário', variant: 'warning' },
    error: { label: 'Erro', variant: 'destructive' },
  };
  return map[rawStatus] || { label: rawStatus || 'Indefinido', variant: 'secondary' };
};

const formatMetricValue = (value) => {
  if (typeof value === 'number') {
    return value.toLocaleString('pt-BR');
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }
  return '—';
};

const humanizeLabel = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    return 'Atualização';
  }

  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
};

const formatTimestampLabel = (value) => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  try {
    return date.toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return date.toISOString();
  }
};

const isDataUrl = (value) => typeof value === 'string' && value.trim().toLowerCase().startsWith('data:');

const isHttpUrl = (value) => typeof value === 'string' && /^https?:\/\//i.test(value.trim());

const isLikelyBase64 = (value) => {
  if (typeof value !== 'string') return false;
  const normalized = value.replace(/\s+/g, '');
  if (normalized.length < 16 || normalized.length % 4 !== 0) {
    return false;
  }
  return /^[A-Za-z0-9+/=]+$/.test(normalized);
};

const isLikelyBaileysString = (value) => {
  if (typeof value !== 'string') return false;
  const normalized = value.trim();
  if (!normalized) return false;
  const commaCount = (normalized.match(/,/g) || []).length;
  return normalized.includes('@') || commaCount >= 3 || /::/.test(normalized);
};

const getQrImageSrc = (qrPayload) => {
  if (!qrPayload) {
    return { code: null, immediate: null, needsGeneration: false, isBaileys: false };
  }

  const codeCandidate =
    qrPayload.qrCode ||
    qrPayload.image ||
    (typeof qrPayload === 'string' ? qrPayload : null) ||
    null;

  if (!codeCandidate) {
    return { code: null, immediate: null, needsGeneration: false, isBaileys: false };
  }

  const normalized = `${codeCandidate}`.trim();

  if (isDataUrl(normalized) || isHttpUrl(normalized)) {
    return { code: normalized, immediate: normalized, needsGeneration: false, isBaileys: false };
  }

  if (isLikelyBase64(normalized)) {
    return {
      code: normalized,
      immediate: `data:image/png;base64,${normalized}`,
      needsGeneration: false,
      isBaileys: false,
    };
  }

  const isBaileys = isLikelyBaileysString(normalized);

  return {
    code: normalized,
    immediate: null,
    needsGeneration: true,
    isBaileys,
  };
};

const useQrImageSource = (qrPayload) => {
  const qrMeta = useMemo(() => getQrImageSrc(qrPayload), [qrPayload]);
  const { code, immediate, needsGeneration } = qrMeta;
  const [src, setSrc] = useState(immediate ?? null);
  const [isGenerating, setIsGenerating] = useState(Boolean(needsGeneration && !immediate));

  useEffect(() => {
    let cancelled = false;

    if (immediate) {
      setSrc(immediate);
      setIsGenerating(false);
      return () => {
        cancelled = true;
      };
    }

    if (!code || !needsGeneration) {
      setSrc(null);
      setIsGenerating(false);
      return () => {
        cancelled = true;
      };
    }

    setSrc(null);
    setIsGenerating(true);
    generateQrDataUrl(code, { type: 'image/png', errorCorrectionLevel: 'M', margin: 1 })
      .then((url) => {
        if (!cancelled) {
          setSrc(url);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Falha ao gerar QR Code', error);
          setSrc(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsGenerating(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code, immediate, needsGeneration]);

  return { src, isGenerating };
};

const formatPhoneNumber = (value) => {
  if (!value) return '—';
  const digits = `${value}`.replace(/\D/g, '');
  if (digits.length < 10) return value;
  const ddd = digits.slice(0, 2);
  const nine = digits.length > 10 ? digits.slice(2, 3) : '';
  const prefix = digits.length > 10 ? digits.slice(3, 7) : digits.slice(2, 6);
  const suffix = digits.length > 10 ? digits.slice(7) : digits.slice(6);
  return `(${ddd}) ${nine}${prefix}-${suffix}`;
};

const resolveInstancePhone = (instance) =>
  instance?.phoneNumber ||
  instance?.number ||
  instance?.msisdn ||
  instance?.metadata?.phoneNumber ||
  instance?.metadata?.phone_number ||
  instance?.metadata?.msisdn ||
  instance?.jid ||
  instance?.session ||
  '';

const extractQrPayload = (payload) => {
  if (!payload) return null;

  const mergeQr = (primary, secondary) => {
    if (!primary) return secondary;
    if (!secondary) return primary;
    return {
      qr: primary.qr ?? secondary.qr ?? null,
      qrCode: primary.qrCode ?? secondary.qrCode ?? primary.qr ?? secondary.qr ?? null,
      qrExpiresAt: primary.qrExpiresAt ?? secondary.qrExpiresAt ?? null,
      expiresAt:
        primary.expiresAt ??
        secondary.expiresAt ??
        primary.qrExpiresAt ??
        secondary.qrExpiresAt ??
        null,
    };
  };

  const parseCandidate = (candidate) => {
    if (!candidate) return null;

    if (typeof candidate === 'string') {
      return { qr: candidate, qrCode: candidate, qrExpiresAt: null, expiresAt: null };
    }

    if (typeof candidate !== 'object') {
      return null;
    }

    const source = candidate;

    const directQr =
      typeof source.qr === 'string'
        ? source.qr
        : typeof source.qrCode === 'string'
        ? source.qrCode
        : typeof source.qr_code === 'string'
        ? source.qr_code
        : typeof source.code === 'string'
        ? source.code
        : typeof source.image === 'string'
        ? source.image
        : typeof source.value === 'string'
        ? source.value
        : null;

    const qrCodeCandidate =
      typeof source.qrCode === 'string'
        ? source.qrCode
        : typeof source.qr_code === 'string'
        ? source.qr_code
        : null;

    const qrExpiresCandidate =
      typeof source.qrExpiresAt === 'string'
        ? source.qrExpiresAt
        : typeof source.qr_expires_at === 'string'
        ? source.qr_expires_at
        : null;

    const expiresCandidate =
      typeof source.expiresAt === 'string'
        ? source.expiresAt
        : typeof source.expiration === 'string'
        ? source.expiration
        : typeof source.expires === 'string'
        ? source.expires
        : null;

    let normalized = null;

    if (directQr || qrCodeCandidate || qrExpiresCandidate || expiresCandidate) {
      normalized = {
        qr: directQr ?? qrCodeCandidate ?? null,
        qrCode: qrCodeCandidate ?? directQr ?? null,
        qrExpiresAt: qrExpiresCandidate ?? null,
        expiresAt: expiresCandidate ?? qrExpiresCandidate ?? null,
      };
    }

    const nestedCandidates = [
      source.qr,
      source.qrData,
      source.qrPayload,
      source.qr_info,
      source.data,
      source.payload,
      source.result,
      source.response,
    ];

    for (const nestedSource of nestedCandidates) {
      const nested = parseCandidate(nestedSource);
      if (nested) {
        normalized = mergeQr(normalized, nested);
        break;
      }
    }

    return normalized;
  };

  const normalized = parseCandidate(payload);

  if (!normalized) {
    return null;
  }

  const finalPayload = { ...normalized };
  if (!finalPayload.qr && finalPayload.qrCode) {
    finalPayload.qr = finalPayload.qrCode;
  }
  if (!finalPayload.qrCode && finalPayload.qr) {
    finalPayload.qrCode = finalPayload.qr;
  }
  if (!finalPayload.expiresAt && finalPayload.qrExpiresAt) {
    finalPayload.expiresAt = finalPayload.qrExpiresAt;
  }
  if (!finalPayload.qrExpiresAt && finalPayload.expiresAt) {
    finalPayload.qrExpiresAt = finalPayload.expiresAt;
  }

  return finalPayload;
};

const extractInstanceFromPayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  if (payload.instance && typeof payload.instance === 'object') {
    return payload.instance;
  }

  if (payload.data && typeof payload.data === 'object') {
    const nested = extractInstanceFromPayload(payload.data);
    if (nested) {
      return nested;
    }
  }

  if (payload.id || payload.name || payload.status || payload.connected) {
    return payload;
  }

  return null;
};

const ensureArrayOfObjects = (value) =>
  Array.isArray(value)
    ? value.filter((item) => item && typeof item === 'object')
    : [];

const looksLikeWhatsAppJid = (value) =>
  typeof value === 'string' && value.toLowerCase().endsWith('@s.whatsapp.net');

const formatInstanceDisplayId = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  if (looksLikeWhatsAppJid(value)) {
    return value.replace(/@s\.whatsapp\.net$/i, '@wa');
  }

  return value;
};

const pickStringValue = (...values) => {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return null;
};

const isPlainRecord = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

const mergeInstanceEntries = (previous, next) => {
  if (!previous) {
    return next;
  }

  const previousMetadata = isPlainRecord(previous.metadata) ? previous.metadata : {};
  const nextMetadata = isPlainRecord(next.metadata) ? next.metadata : {};

  const mergedMetadata = { ...previousMetadata, ...nextMetadata };

  return {
    ...previous,
    ...next,
    metadata: Object.keys(mergedMetadata).length > 0 ? mergedMetadata : undefined,
    connected: Boolean(previous.connected || next.connected),
    status:
      next.status ||
      previous.status ||
      (previous.connected || next.connected ? 'connected' : 'disconnected'),
    tenantId: next.tenantId ?? previous.tenantId ?? null,
    name: next.name ?? previous.name ?? null,
    phoneNumber: next.phoneNumber ?? previous.phoneNumber ?? null,
    displayId: next.displayId || previous.displayId || next.id || previous.id,
    source: next.source || previous.source || null,
  };
};

const normalizeInstanceRecord = (entry) => {
  if (!isPlainRecord(entry)) {
    return null;
  }

  const base = entry;
  const metadata = isPlainRecord(base.metadata) ? base.metadata : {};
  const profile = isPlainRecord(base.profile) ? base.profile : {};
  const details = isPlainRecord(base.details) ? base.details : {};
  const info = isPlainRecord(base.info) ? base.info : {};
  const mergedMetadata = { ...metadata, ...profile, ...details, ...info };

  const id =
    pickStringValue(
      base.id,
      base.instanceId,
      base.instance_id,
      base.sessionId,
      base.session_id,
      mergedMetadata.id,
      mergedMetadata.instanceId,
      mergedMetadata.instance_id,
      mergedMetadata.sessionId,
      mergedMetadata.session_id
    ) ?? null;

  if (!id) {
    return null;
  }

  const rawStatus =
    pickStringValue(base.status, base.connectionStatus, base.state, mergedMetadata.status, mergedMetadata.state) ??
    null;
  const normalizedStatus = rawStatus ? rawStatus.toLowerCase() : null;

  const connectedValue =
    typeof base.connected === 'boolean'
      ? base.connected
      : typeof mergedMetadata.connected === 'boolean'
        ? mergedMetadata.connected
        : normalizedStatus === 'connected';

  const tenantId =
    pickStringValue(
      base.tenantId,
      base.tenant_id,
      mergedMetadata.tenantId,
      mergedMetadata.tenant_id,
      base.agreementId,
      mergedMetadata.agreementId,
      base.accountId,
      mergedMetadata.accountId
    ) ?? null;

  const name =
    pickStringValue(
      base.name,
      mergedMetadata.name,
      mergedMetadata.displayName,
      mergedMetadata.instanceName,
      mergedMetadata.sessionName,
      mergedMetadata.profileName
    ) ?? null;

  const phoneNumber =
    pickStringValue(
      base.phoneNumber,
      base.phone,
      base.number,
      mergedMetadata.phoneNumber,
      mergedMetadata.phone,
      mergedMetadata.number
    ) ?? null;

  const source =
    pickStringValue(base.source, mergedMetadata.source, mergedMetadata.origin, base.origin) ??
    (looksLikeWhatsAppJid(id) ? 'broker' : 'db');

  const normalizedStatusValue = normalizedStatus || (connectedValue ? 'connected' : 'disconnected');

  const normalized = {
    ...base,
    metadata: mergedMetadata,
    id,
    tenantId,
    name,
    phoneNumber,
    status: normalizedStatusValue,
    connected: Boolean(connectedValue),
    displayId: formatInstanceDisplayId(id),
    source,
  };

  return normalized;
};

const normalizeInstancesCollection = (rawList, options = {}) => {
  const allowedTenants = Array.isArray(options.allowedTenants)
    ? options.allowedTenants
        .filter((value) => typeof value === 'string')
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    : [];
  const shouldFilterByTenant =
    (options.filterByTenant === true || options.enforceTenantScope === true) &&
    allowedTenants.length > 0;

  const order = [];
  const map = new Map();

  if (!Array.isArray(rawList)) {
    return [];
  }

  for (const entry of rawList) {
    const normalized = normalizeInstanceRecord(entry);
    if (!normalized) {
      continue;
    }

    if (
      shouldFilterByTenant &&
      normalized.tenantId &&
      !allowedTenants.includes(normalized.tenantId)
    ) {
      continue;
    }

    if (looksLikeWhatsAppJid(normalized.id) && normalized.source === 'broker' && normalized.connected !== true) {
      continue;
    }

    const existing = map.get(normalized.id);
    const merged = mergeInstanceEntries(existing, normalized);

    if (!existing) {
      order.push(normalized.id);
    }

    map.set(normalized.id, merged);
  }

  return order.map((id) => map.get(id)).filter(Boolean);
};

const unwrapWhatsAppResponse = (payload) => {
  if (!payload) {
    return {};
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    if (payload.data && typeof payload.data === 'object') {
      return payload.data;
    }
    if (payload.result && typeof payload.result === 'object') {
      return payload.result;
    }
  }

  return payload;
};

const parseInstancesPayload = (payload) => {
  const data = unwrapWhatsAppResponse(payload);

  const rootIsObject = data && typeof data === 'object' && !Array.isArray(data);

  let instances = [];
  if (rootIsObject && Array.isArray(data.instances)) {
    instances = ensureArrayOfObjects(data.instances);
  } else if (rootIsObject && Array.isArray(data.items)) {
    instances = ensureArrayOfObjects(data.items);
  } else if (rootIsObject && Array.isArray(data.data)) {
    instances = ensureArrayOfObjects(data.data);
  } else if (Array.isArray(data)) {
    instances = ensureArrayOfObjects(data);
  }

  const instance = extractInstanceFromPayload(rootIsObject ? data : null) || null;

  if (instance && !instances.some((item) => item && item.id === instance.id)) {
    instances = [...instances, instance];
  }

  const statusPayload = rootIsObject
    ? typeof data.status === 'object' && data.status !== null
      ? data.status
      : typeof data.instanceStatus === 'object' && data.instanceStatus !== null
        ? data.instanceStatus
        : null
    : null;

  const status =
    typeof statusPayload?.status === 'string'
      ? statusPayload.status
      : typeof data?.status === 'string'
        ? data.status
        : typeof instance?.status === 'string'
          ? instance.status
          : null;

  const connected =
    typeof data?.connected === 'boolean'
      ? data.connected
      : typeof statusPayload?.connected === 'boolean'
        ? statusPayload.connected
        : typeof instance?.connected === 'boolean'
          ? instance.connected
          : null;

  const instanceId =
    typeof data?.instanceId === 'string' && data.instanceId.trim().length > 0
      ? data.instanceId.trim()
      : typeof instance?.id === 'string'
        ? instance.id
        : null;

  const qr = extractQrPayload(
    (rootIsObject && data.qr !== undefined ? data.qr : null) ?? statusPayload ?? data
  );

  return {
    raw: payload,
    data,
    instances,
    instance,
    status,
    statusPayload,
    connected,
    instanceId,
    qr,
  };
};

const WhatsAppConnect = ({
  selectedAgreement,
  status = 'disconnected',
  activeCampaign,
  onboarding,
  onStatusChange,
  onCampaignReady,
  onContinue,
  onBack,
}) => {
  const { log, warn, error: logError } = usePlayfulLogger('🎯 LeadEngine • WhatsApp');
  const pollIdRef = useRef(0);
  const [instances, setInstances] = useState([]);
  const [instance, setInstance] = useState(null);
  const [instancesReady, setInstancesReady] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [loadingQr, setLoadingQr] = useState(false);
  const [authToken, setAuthTokenState] = useState(() => getAuthToken());
  const [sessionActive, setSessionActive] = useState(() => Boolean(getAuthToken()));
  const [authDeferred, setAuthDeferred] = useState(false);
  const [errorState, setErrorState] = useState(null);
  const [localStatus, setLocalStatus] = useState(status);
  const [qrPanelOpen, setQrPanelOpen] = useState(status !== 'connected');
  const [campaign, setCampaign] = useState(activeCampaign || null);
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignError, setCampaignError] = useState(null);
  const [campaignAction, setCampaignAction] = useState(null);
  const [isQrDialogOpen, setQrDialogOpen] = useState(false);
  const [deletingInstanceId, setDeletingInstanceId] = useState(null);
  const [instancePendingDelete, setInstancePendingDelete] = useState(null);
  const [liveEvents, setLiveEvents] = useState([]);
  const [isCreateInstanceOpen, setCreateInstanceOpen] = useState(false);
  const [isCreateCampaignOpen, setCreateCampaignOpen] = useState(false);
  const [pendingReassign, setPendingReassign] = useState(null);
  const [persistentWarning, setPersistentWarning] = useState(null);
  const loadInstancesRef = useRef(() => {});
  const loadCampaignsRef = useRef(() => {});
  const hasFetchedOnceRef = useRef(false);
  const sessionActiveRef = useRef(sessionActive);
  const loadingInstancesRef = useRef(loadingInstances);
  const loadingQrRef = useRef(loadingQr);

  const requireAuthMessage =
    'Para consultar as instâncias de WhatsApp, autentique-se usando o botão “Login demo” e gere um token ativo.';

  const isAuthError = (error) => {
    const status = typeof error?.status === 'number' ? error.status : null;
    return status === 401 || status === 403;
  };

  const handleAuthFallback = ({ reset = false } = {}) => {
    setSessionActive(false);
    setAuthDeferred(true);
    setAuthTokenState(null);
    setLoadingInstances(false);
    setLoadingQr(false);
    setErrorMessage(requireAuthMessage, {
      requiresAuth: true,
      title: 'Autenticação necessária',
    });
    if (reset) {
      setInstances([]);
      setInstance(null);
      clearInstancesCache(selectedAgreement?.id);
      setLocalStatus('disconnected');
      setQrData(null);
      setSecondsLeft(null);
      setInstancesReady(true);
    }
  };

  const enforceAuthPrompt = () => {
    handleAuthFallback({ reset: true });
  };

  const setErrorMessage = (message, meta = {}) => {
    if (message) {
      const copy = resolveWhatsAppErrorCopy(meta.code, message);
      const resolvedState = {
        ...meta,
        code: copy.code ?? meta.code ?? null,
        title: meta.title ?? copy.title ?? 'Algo deu errado',
        message: copy.description ?? message,
      };
      setErrorState(resolvedState);
    } else {
      setErrorState(null);
    }
  };

  const resolveFriendlyError = (error, fallbackMessage) => {
    const codeCandidate = error?.payload?.error?.code ?? error?.code ?? null;
    const rawMessage =
      error?.payload?.error?.message ?? (error instanceof Error ? error.message : fallbackMessage);
    const copy = resolveWhatsAppErrorCopy(codeCandidate, rawMessage ?? fallbackMessage);
    return {
      code: copy.code,
      title: copy.title,
      message: copy.description ?? rawMessage ?? fallbackMessage,
    };
  };

  const applyErrorMessageFromError = (error, fallbackMessage, meta = {}) => {
    const friendly = resolveFriendlyError(error, fallbackMessage);
    setErrorMessage(friendly.message, {
      ...meta,
      code: friendly.code ?? meta.code,
      title: friendly.title ?? meta.title,
    });
    return friendly;
  };

  useEffect(() => {
    const agreementId = selectedAgreement?.id;
    if (!agreementId) {
      setInstances([]);
      setInstance(null);
      setInstancesReady(true);
      return;
    }

    const cached = readInstancesCache(agreementId);
    if (!cached) {
      setInstancesReady(false);
      return;
    }

    const list = Array.isArray(cached.list) ? cached.list : [];
    if (list.length > 0) {
      const current = cached.currentId
        ? list.find((item) => item.id === cached.currentId) || list[0]
        : list[0];
      setInstances(list);
      setInstance(current ?? null);
      if (current?.status) {
        setLocalStatus(current.status);
      }
      setInstancesReady(true);
    } else {
      setInstancesReady(false);
    }
    hasFetchedOnceRef.current = false;
  }, [selectedAgreement?.id]);

  const copy = statusCopy[localStatus] ?? statusCopy.disconnected;

  const expiresAt = useMemo(() => {
    if (!qrData?.expiresAt) return null;
    return new Date(qrData.expiresAt).getTime();
  }, [qrData]);

  const stageIndex = onboarding?.stages?.findIndex((stage) => stage.id === 'whatsapp') ?? 2;
  const totalStages = onboarding?.stages?.length ?? 0;
  const stepNumber = stageIndex >= 0 ? stageIndex + 1 : 3;
  const stepLabel = totalStages ? `Passo ${Math.min(stepNumber, totalStages)} de ${totalStages}` : 'Passo 3';
  const nextStage = onboarding?.stages?.[Math.min(stageIndex + 1, totalStages - 1)]?.label ?? 'Inbox de Leads';
  const hasAgreement = Boolean(selectedAgreement);
  const hasCampaign = Boolean(campaign);
  const { src: qrImageSrc, isGenerating: isGeneratingQrImage } = useQrImageSource(qrData);
  const generatingQrRef = useRef(isGeneratingQrImage);
  const hasQr = Boolean(qrImageSrc);
  const isAuthenticated = (sessionActive || Boolean(authToken)) && !authDeferred;
  const canContinue = localStatus === 'connected' && instance && hasAgreement;
  const statusTone = copy.tone || 'border-white/10 bg-white/10 text-white';
  const countdownMessage = secondsLeft !== null ? `QR expira em ${secondsLeft}s` : null;
  const isBusy = loadingInstances || loadingQr || isGeneratingQrImage;
  const confirmLabel = hasCampaign ? 'Ir para a inbox de leads' : 'Configurar campanha';
  const confirmDisabled = !isAuthenticated || !canContinue || isBusy;
  const qrStatusMessage = localStatus === 'connected'
    ? 'Conexão ativa — QR oculto.'
    : countdownMessage || (loadingQr || isGeneratingQrImage ? 'Gerando QR Code…' : 'Selecione uma instância para gerar o QR.');
  const selectedInstanceStatusInfo = instance ? getStatusInfo(instance) : null;
  const selectedInstancePhone = instance ? resolveInstancePhone(instance) : '';
  const instanceCount = instances.length;
  const instancesCountLabel = instancesReady ? `${instanceCount} ativa(s)` : 'Sincronizando…';

  const handleRealtimeEvent = useCallback((event) => {
    if (!event || typeof event !== 'object' || !event.payload) {
      return;
    }

    const payload = event.payload;
    const eventInstanceId =
      payload.id || payload.instanceId || payload.brokerId || payload.sessionId || null;

    if (!eventInstanceId) {
      return;
    }

    const timestampCandidate =
      (typeof payload.syncedAt === 'string' && payload.syncedAt) ||
      (typeof payload.timestamp === 'string' && payload.timestamp) ||
      new Date().toISOString();

    const statusCandidate = (() => {
      if (typeof payload.status === 'string') {
        return payload.status;
      }
      if (payload.status && typeof payload.status === 'object') {
        if (typeof payload.status.current === 'string') {
          return payload.status.current;
        }
        if (typeof payload.status.status === 'string') {
          return payload.status.status;
        }
      }
      return null;
    })();

    const connectedCandidate = (() => {
      if (typeof payload.connected === 'boolean') {
        return payload.connected;
      }
      if (payload.status && typeof payload.status === 'object') {
        if (typeof payload.status.connected === 'boolean') {
          return payload.status.connected;
        }
      }
      return null;
    })();

    const phoneCandidate = (() => {
      if (typeof payload.phoneNumber === 'string') {
        return payload.phoneNumber;
      }
      if (payload.metadata && typeof payload.metadata === 'object') {
        const metadata = payload.metadata;
        if (typeof metadata.phoneNumber === 'string') {
          return metadata.phoneNumber;
        }
        if (typeof metadata.phone_number === 'string') {
          return metadata.phone_number;
        }
        if (typeof metadata.msisdn === 'string') {
          return metadata.msisdn;
        }
      }
      return null;
    })();

    setLiveEvents((previous) => {
      const next = [
        {
          id: `${event.type}-${eventInstanceId}-${timestampCandidate}`,
          instanceId: eventInstanceId,
          type: typeof event.type === 'string' && event.type ? event.type : 'updated',
          status: statusCandidate,
          connected: connectedCandidate,
          phoneNumber: phoneCandidate,
          timestamp: timestampCandidate,
        },
        ...previous,
      ];

      const seen = new Set();
      const deduped = [];
      for (const entry of next) {
        const key = `${entry.instanceId}-${entry.timestamp}-${entry.type}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        deduped.push(entry);
        if (deduped.length >= 30) {
          break;
        }
      }

      return deduped;
    });
  }, []);

  const tenantRoomId = selectedAgreement?.tenantId ?? selectedAgreement?.id ?? null;

  const { connected: realtimeConnected } = useInstanceLiveUpdates({
    tenantId: tenantRoomId,
    enabled: Boolean(tenantRoomId) && !authDeferred,
    onEvent: handleRealtimeEvent,
  });

  useEffect(() => {
    setLiveEvents([]);
  }, [selectedAgreement?.id]);

  const timelineItems = useMemo(() => {
    if (!instance) {
      return [];
    }

    const metadata =
      instance.metadata && typeof instance.metadata === 'object' ? instance.metadata : {};
    const historyEntries = Array.isArray(metadata.history) ? metadata.history : [];

    const normalizedHistory = historyEntries
      .map((entry, index) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }
        const timestamp =
          (typeof entry.at === 'string' && entry.at) ||
          (typeof entry.timestamp === 'string' && entry.timestamp) ||
          null;

        return {
          id: `history-${instance.id}-${timestamp ?? index}`,
          instanceId: instance.id,
          type: typeof entry.action === 'string' ? entry.action : 'status-sync',
          status: typeof entry.status === 'string' ? entry.status : entry.status ?? null,
          connected: typeof entry.connected === 'boolean' ? entry.connected : null,
          phoneNumber: typeof entry.phoneNumber === 'string' ? entry.phoneNumber : null,
          timestamp: timestamp ?? new Date(Date.now() - index * 1000).toISOString(),
        };
      })
      .filter(Boolean);

    const liveForInstance = liveEvents.filter((event) => event.instanceId === instance.id);

    const merged = [...liveForInstance, ...normalizedHistory];

    return merged
      .sort((a, b) => {
        const aTime = new Date(a.timestamp ?? '').getTime();
        const bTime = new Date(b.timestamp ?? '').getTime();
        return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
      })
      .slice(0, 12);
  }, [instance, liveEvents]);

  const handleRefreshInstances = useCallback(() => {
    void loadInstancesRef.current?.({ forceRefresh: true });
  }, []);

  useEffect(() => {
    if (!selectedAgreement?.id) {
      return;
    }
    if (!isAuthenticated) {
      return;
    }
    void loadInstances({ forceRefresh: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, selectedAgreement?.id]);

  useEffect(() => {
    if (!isAuthenticated) {
      setInstancesReady(true);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    setLocalStatus(status);
  }, [status]);

  useEffect(() => {
    setQrPanelOpen(localStatus !== 'connected');
  }, [localStatus]);

  useEffect(() => {
    sessionActiveRef.current = sessionActive;
  }, [sessionActive]);

  useEffect(() => {
    setCampaign(activeCampaign || null);
  }, [activeCampaign]);

  useEffect(() => {
    loadingInstancesRef.current = loadingInstances;
  }, [loadingInstances]);

  useEffect(() => {
    loadingQrRef.current = loadingQr;
  }, [loadingQr]);

  useEffect(() => {
    generatingQrRef.current = isGeneratingQrImage;
  }, [isGeneratingQrImage]);

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }

    let cancelled = false;
    let timeoutId;

    const resolveNextDelay = (result) => {
      if (!result || result.success || result.skipped) {
        return DEFAULT_POLL_INTERVAL_MS;
      }

      const retryAfterMs = parseRetryAfterMs(result.error?.retryAfter);
      if (retryAfterMs !== null) {
        return retryAfterMs > 0 ? retryAfterMs : DEFAULT_POLL_INTERVAL_MS;
      }

      if (result.error?.status === 429) {
        return RATE_LIMIT_COOLDOWN_MS;
      }

      return DEFAULT_POLL_INTERVAL_MS;
    };

    const scheduleNext = (delay = DEFAULT_POLL_INTERVAL_MS) => {
      if (cancelled) {
        return;
      }

      const normalizedDelay =
        typeof delay === 'number' && Number.isFinite(delay) && delay >= 0
          ? delay
          : DEFAULT_POLL_INTERVAL_MS;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(runPoll, normalizedDelay);
    };

    const runPoll = async () => {
      if (cancelled) {
        return;
      }

      if (loadingInstancesRef.current || loadingQrRef.current || generatingQrRef.current) {
        scheduleNext(DEFAULT_POLL_INTERVAL_MS);
        return;
      }

      const result = await Promise.resolve()
        .then(() => loadInstancesRef.current?.())
        .catch((error) => ({ success: false, error }));

      if (cancelled) {
        return;
      }

      const delay = resolveNextDelay(result);
      scheduleNext(delay);
    };

    runPoll();

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [selectedAgreement?.id, isAuthenticated]);

  useEffect(() => {
    if (!selectedAgreement) {
      setCampaign(null);
      return undefined;
    }

    let cancelled = false;

    const hydrateCampaign = async () => {
      try {
        const response = await apiGet(
          `/api/campaigns?agreementId=${selectedAgreement.id}&status=active`
        );
        if (cancelled) return;
        const campaigns = Array.isArray(response?.items)
          ? response.items
          : Array.isArray(response?.data)
          ? response.data
          : [];
        const existing = campaigns.length > 0 ? campaigns[0] : null;
        if (existing) {
          setCampaign(existing);
          onCampaignReady?.(existing);
        } else {
          setCampaign(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('Não foi possível carregar campanhas existentes', err);
        }
      }
    };

    void hydrateCampaign();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgreement?.id]);

  useEffect(() => {
    if (!expiresAt || localStatus === 'connected') {
      setSecondsLeft(null);
      return undefined;
    }

    const tick = () => {
      const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setSecondsLeft(diff);
      if (diff === 0) {
        setLocalStatus('qr_required');
        onStatusChange?.('disconnected');
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, localStatus, onStatusChange]);

  const pickCurrentInstance = (list) => {
    if (!Array.isArray(list) || list.length === 0) {
      return null;
    }

    const connected = list.find((item) => item.connected === true);
    return connected || list[0];
  };

  const connectInstance = async (instanceId = null) => {
    const response = await apiPost(
      '/api/integrations/whatsapp/instances/connect',
      instanceId ? { instanceId } : {}
    );
    setSessionActive(true);
    setAuthDeferred(false);

    const parsed = parseInstancesPayload(response);

    const resolvedInstanceId = parsed.instanceId || instanceId || null;
    const resolvedStatus = parsed.status || (parsed.connected === false ? 'disconnected' : null);
    const resolvedConnected =
      typeof parsed.connected === 'boolean'
        ? parsed.connected
        : resolvedStatus
        ? resolvedStatus === 'connected'
        : null;

    let instance = parsed.instance;
    if (instance && resolvedInstanceId && instance.id !== resolvedInstanceId) {
      instance = { ...instance, id: resolvedInstanceId };
    } else if (!instance && resolvedInstanceId) {
      instance = {
        id: resolvedInstanceId,
        status: resolvedStatus ?? undefined,
        connected: resolvedConnected ?? undefined,
      };
    }

    const instances = ensureArrayOfObjects(parsed.instances);

    return {
      instanceId: resolvedInstanceId,
      status: resolvedStatus,
      connected: resolvedConnected,
      qr: parsed.qr,
      instance: instance
        ? {
            ...instance,
            status: resolvedStatus ?? instance.status,
            connected:
              typeof resolvedConnected === 'boolean'
                ? resolvedConnected
                : typeof instance.connected === 'boolean'
                ? instance.connected
                : undefined,
          }
        : null,
      instances,
    };
  };

  const loadInstances = async ({
    connectResult: providedConnect,
    preferredInstanceId,
    forceRefresh,
  } = {}) => {
    const agreementId = selectedAgreement?.id;
    const token = getAuthToken();
    setAuthTokenState(token);
    if (!hasFetchedOnceRef.current) {
      setInstancesReady(false);
    }
    setLoadingInstances(true);
    setErrorMessage(null);
    try {
      log('🚀 Iniciando sincronização de instâncias WhatsApp', {
        tenantAgreement: selectedAgreement?.id ?? null,
        preferredInstanceId: preferredInstanceId ?? null,
      });
      const shouldForceBrokerSync =
        typeof forceRefresh === 'boolean' ? forceRefresh : true;

      log('🛰️ Solicitando lista de instâncias', {
        agreementId,
        forceRefresh: shouldForceBrokerSync,
        hasFetchedOnce: hasFetchedOnceRef.current,
      });
      const instancesUrl = agreementId
        ? `/api/integrations/whatsapp/instances?agreementId=${encodeURIComponent(
            agreementId
          )}&refresh=1`
        : '/api/integrations/whatsapp/instances?refresh=1';
      const response = await apiGet(instancesUrl);
      const parsedResponse = parseInstancesPayload(response);
      setSessionActive(true);
      setAuthDeferred(false);
      let list = ensureArrayOfObjects(parsedResponse.instances);
      let hasServerList = true;
      let connectResult = providedConnect || null;

      if (list.length === 0 && !shouldForceBrokerSync) {
        const refreshed = await apiGet(instancesUrl).catch(
          () => null
        );
        if (refreshed) {
          const parsedRefreshed = parseInstancesPayload(refreshed);
          const refreshedList = ensureArrayOfObjects(parsedRefreshed.instances);
          if (refreshedList.length > 0) {
            list = refreshedList;
          }
        }
      }

      if (list.length === 0) {
        const fallbackInstanceId = preferredInstanceId || campaign?.instanceId || null;
        if (fallbackInstanceId) {
          connectResult = connectResult || (await connectInstance(fallbackInstanceId));
        } else {
          warn('Nenhuma instância padrão disponível para conexão automática', {
            agreementId,
            preferredInstanceId: preferredInstanceId ?? null,
            campaignInstanceId: campaign?.instanceId ?? null,
          });
        }

        if (connectResult?.instances?.length) {
          list = ensureArrayOfObjects(connectResult.instances);
        } else if (connectResult?.instance) {
          list = ensureArrayOfObjects([connectResult.instance]);
        }
      }

      let current = null;
      if (preferredInstanceId) {
        current =
          list.find(
            (item) => item.id === preferredInstanceId || item.name === preferredInstanceId
          ) || null;
      }
      if (!current && campaign?.instanceId) {
        current =
          list.find(
            (item) => item.id === campaign.instanceId || item.name === campaign.instanceId
          ) || null;
      }

      if (!current) {
        current = pickCurrentInstance(list);
      }

      if (!current && connectResult?.instance) {
        current = connectResult.instance;
      }

      if (current && (connectResult?.status || connectResult?.instance)) {
        const merged = {
          ...current,
          ...(connectResult?.instance ? connectResult.instance : {}),
          status: connectResult.status ?? current.status,
          connected:
            typeof connectResult?.connected === 'boolean'
              ? connectResult.connected
              : typeof current.connected === 'boolean'
              ? current.connected
              : false,
        };
        current = merged;
        list = list.map((item) => (item.id === merged.id ? { ...item, ...merged } : item));
      } else if (connectResult?.instance) {
        const candidate = connectResult.instance;
        list = list.map((item) => (item.id === candidate.id ? { ...item, ...candidate } : item));
      }

      const normalizedList = normalizeInstancesCollection(list);
      list = normalizedList;

      if (current) {
        const normalizedCurrent = normalizedList.find((item) => item.id === current.id);
        if (normalizedCurrent) {
          current = { ...normalizedCurrent, ...current };
          list = normalizedList.map((item) => (item.id === current.id ? { ...item, ...current } : item));
        } else if (normalizedList.length > 0) {
          current = pickCurrentInstance(normalizedList);
        } else {
          current = null;
        }
      } else if (normalizedList.length > 0) {
        current = pickCurrentInstance(normalizedList);
      }

      const resolvedTotal = Array.isArray(list) ? list.length : instances.length;

      hasFetchedOnceRef.current = true;

      if (Array.isArray(list) && list.length > 0) {
        setInstances(list);
        setInstance(current);
        persistInstancesCache(agreementId, list, current?.id ?? null);
      } else if (hasServerList) {
        setInstances([]);
        setInstance(null);
        clearInstancesCache(agreementId);
      } else {
        warn('Servidor não retornou instâncias; reutilizando cache local', {
          agreementId,
          preferredInstanceId,
        });
      }

      const statusFromInstance =
        connectResult?.status ||
        (typeof connectResult?.connected === 'boolean'
          ? connectResult.connected
            ? 'connected'
            : 'disconnected'
          : null) ||
        current?.status ||
        'disconnected';
      setAuthDeferred(false);
      setLocalStatus(statusFromInstance);
      onStatusChange?.(statusFromInstance);

      const connectQr = connectResult?.qr;
      const shouldShowQrFromConnect =
        connectResult && connectResult.connected === false && Boolean(connectQr?.qrCode);

      if (shouldShowQrFromConnect) {
        setQrData(connectQr);
      } else if (current && statusFromInstance !== 'connected') {
        await generateQr(current.id, { skipConnect: Boolean(connectResult) });
      } else {
        setQrData(null);
        setSecondsLeft(null);
      }
      log('✅ Instâncias sincronizadas', {
        total: resolvedTotal,
        status: statusFromInstance,
        instanceId: current?.id ?? null,
        forceRefresh: shouldForceBrokerSync,
      });
      return { success: true, status: statusFromInstance };
    } catch (err) {
      const status = err?.response?.status;
      const errorCode = err?.response?.data?.code ?? err?.code;
      const isMissingInstanceError = status === 404 || errorCode === 'INSTANCE_NOT_FOUND';

      if (isAuthError(err)) {
        handleAuthFallback();
      } else if (!isMissingInstanceError) {
        applyErrorMessageFromError(
          err,
          'Não foi possível carregar status do WhatsApp'
        );
        if (!isMissingInstanceError) {
          setErrorMessage(
            err instanceof Error ? err.message : 'Não foi possível carregar status do WhatsApp'
          );
        } else {
          setErrorMessage(null);
        }
      }
      warn('Instâncias não puderam ser carregadas', err);
      return { success: false, error: err, skipped: isAuthError(err) };
    } finally {
      setLoadingInstances(false);
      setInstancesReady(true);
    }
  };
  loadInstancesRef.current = loadInstances;

  const loadCampaigns = async () => {
    if (!selectedAgreement?.id) {
      setCampaigns([]);
      if (campaign) {
        setCampaign(null);
      }
      return { success: true, items: [] };
    }

    setCampaignsLoading(true);
    setCampaignError(null);

    try {
      const response = await apiGet(
        `/api/campaigns?agreementId=${encodeURIComponent(selectedAgreement.id)}&status=active,paused,draft,ended`
      );
      const list = Array.isArray(response?.items)
        ? response.items
        : Array.isArray(response?.data)
        ? response.data
        : [];

      setCampaigns(list);

      const preferred = (() => {
        if (campaign?.id) {
          const match = list.find((entry) => entry.id === campaign.id);
          if (match) {
            return match;
          }
        }

        if (instance?.id) {
          const activeMatch = list.find(
            (entry) => entry.instanceId === instance.id && entry.status === 'active'
          );
          if (activeMatch) {
            return activeMatch;
          }

          const instanceMatch = list.find((entry) => entry.instanceId === instance.id);
          if (instanceMatch) {
            return instanceMatch;
          }
        }

        const firstActive = list.find((entry) => entry.status === 'active');
        return firstActive ?? list[0] ?? null;
      })();

      const previousId = campaign?.id ?? null;
      const nextId = preferred?.id ?? null;

      if (nextId !== previousId) {
        setCampaign(preferred ?? null);
        if (preferred) {
          onCampaignReady?.(preferred);
        }
      } else if (preferred) {
        onCampaignReady?.(preferred);
      }

      return { success: true, items: list };
    } catch (err) {
      if (isAuthError(err)) {
        handleAuthFallback();
      } else {
        setCampaignError(
          err instanceof Error ? err.message : 'Não foi possível carregar campanhas'
        );
      }
      return { success: false, error: err };
    } finally {
      setCampaignsLoading(false);
    }
  };
  loadCampaignsRef.current = loadCampaigns;

  useEffect(() => {
    const unsubscribe = onAuthTokenChange((token) => {
      setAuthTokenState(token);
      if (token) {
        setSessionActive(true);
        setAuthDeferred(false);
        setErrorMessage(null);
        void loadInstancesRef.current?.({ forceRefresh: true });
      } else if (!sessionActiveRef.current) {
        enforceAuthPrompt();
      }
    });
    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgreement?.id]);

  useEffect(() => {
    if (!selectedAgreement?.id) {
      setCampaigns([]);
      setCampaign(null);
      setPersistentWarning(null);
      return undefined;
    }

    let cancelled = false;

    const fetchCampaigns = async () => {
      const result = await loadCampaignsRef.current?.();
      if (!cancelled && result?.error && !isAuthError(result.error)) {
        warn('Falha ao listar campanhas', result.error);
      }
    };

    void fetchCampaigns();

    return () => {
      cancelled = true;
    };
  }, [selectedAgreement?.id, warn]);

  useEffect(() => {
    if (!selectedAgreement?.id) {
      setPersistentWarning(null);
      if (campaign) {
        setCampaign(null);
      }
      return;
    }

    if (!campaigns.length) {
      if (campaign) {
        setCampaign(null);
      }
      const warningMessage =
        'Nenhuma campanha cadastrada para este convênio. As mensagens inbound serão ignoradas até configurar uma campanha ativa.';
      setPersistentWarning(warningMessage);
      return;
    }

    const activeForAgreement = campaigns.filter((entry) => entry.status === 'active');
    let warningMessage = null;

    if (activeForAgreement.length === 0) {
      warningMessage =
        'Nenhuma campanha ativa para este convênio. Leads inbound serão descartados até ativar ou criar uma campanha.';
    } else if (instance?.id && !activeForAgreement.some((entry) => entry.instanceId === instance.id)) {
      warningMessage =
        'A instância selecionada não possui campanhas ativas. Se uma mensagem chegar, ela será ignorada até que alguma campanha seja reativada ou criada para este número.';
    }

    setPersistentWarning(warningMessage);

    if (instance?.id) {
      const activeMatch = campaigns.find(
        (entry) => entry.instanceId === instance.id && entry.status === 'active'
      );
      if (activeMatch && activeMatch.id !== (campaign?.id ?? null)) {
        setCampaign(activeMatch);
        onCampaignReady?.(activeMatch);
        return;
      }

      const instanceMatch = campaigns.find((entry) => entry.instanceId === instance.id);
      if (instanceMatch && instanceMatch.id !== (campaign?.id ?? null)) {
        setCampaign(instanceMatch);
        onCampaignReady?.(instanceMatch);
        return;
      }
    }

    if (!campaign) {
      const fallback =
        campaigns.find((entry) => entry.status === 'active') ?? campaigns[0] ?? null;
      if (fallback) {
        setCampaign(fallback);
        onCampaignReady?.(fallback);
      }
    }
  }, [campaign, campaigns, instance?.id, onCampaignReady, selectedAgreement?.id]);

  const handleCreateInstance = () => {
    if (!selectedAgreement) {
      setErrorMessage('Selecione um convênio antes de criar uma instância.');
      return;
    }
    setCreateInstanceOpen(true);
  };

  const submitCreateInstance = async ({ name, id }) => {
    if (!selectedAgreement) {
      throw new Error('Selecione um convênio para criar uma instância.');
    }

    const normalizedName = `${name ?? ''}`.trim();
    if (!normalizedName) {
      const error = new Error('Informe um nome válido para a nova instância.');
      setErrorMessage(error.message);
      throw error;
    }

    const payloadBody = {
      agreementId: selectedAgreement.id,
      agreementName: selectedAgreement.name ?? undefined,
      tenantId: selectedAgreement.tenantId ?? undefined,
      name: normalizedName,
      ...(id ? { id: `${id}`.trim() } : {}),
    };

    setLoadingInstances(true);
    setErrorMessage(null);

    try {
      log('🧪 Criando nova instância WhatsApp', {
        agreementId: selectedAgreement.id,
        name: normalizedName,
      });

      const response = await apiPost('/api/integrations/whatsapp/instances', payloadBody);
      setSessionActive(true);
      const payload = response?.data ?? {};
      const createdInstance = extractInstanceFromPayload(payload);
      const createdInstanceId = createdInstance?.id ?? createdInstance?.instanceId ?? null;

      let connectResult = null;

      if (createdInstanceId) {
        try {
          const startResult = await connectInstance(createdInstanceId);
          if (startResult) {
            connectResult = {
              ...startResult,
              instance: {
                ...createdInstance,
                ...(startResult.instance || {}),
              },
            };
          }
        } catch (startError) {
          console.warn('Não foi possível iniciar a instância recém-criada', startError);
          connectResult = {
            status: createdInstance?.status,
            connected:
              typeof createdInstance?.connected === 'boolean'
                ? createdInstance.connected
                : createdInstance?.status === 'connected'
                ? true
                : undefined,
            qr: null,
            instance: createdInstance || null,
          };
        }
      }

      if (!connectResult && createdInstance) {
        connectResult = {
          status: createdInstance.status,
          connected:
            typeof createdInstance.connected === 'boolean'
              ? createdInstance.connected
              : createdInstance.status === 'connected'
              ? true
              : undefined,
          qr: extractQrPayload(payload),
          instance: createdInstance,
        };
      }

      await loadInstances({
        connectResult: connectResult || undefined,
        preferredInstanceId: createdInstanceId || normalizedName,
        forceRefresh: true,
      });

      log('🎉 Instância criada com sucesso', {
        instanceId: createdInstanceId,
        name: normalizedName,
      });

      return { instanceId: createdInstanceId ?? normalizedName };
    } catch (err) {
      if (isAuthError(err)) {
        handleAuthFallback();
        throw err;
      }

      const friendly = applyErrorMessageFromError(
        err,
        'Não foi possível criar uma nova instância'
      );
      logError('Falha ao criar instância WhatsApp', err);
      const errorToThrow = err instanceof Error ? err : new Error(friendly.message);
      throw errorToThrow;
    } finally {
      setLoadingInstances(false);
    }
  };

  const createCampaign = async ({ name, instanceId, status = 'active' }) => {
    if (!selectedAgreement) {
      throw new Error('Selecione um convênio para criar campanhas.');
    }

    const normalizedName = `${name ?? ''}`.trim();
    if (!instanceId) {
      const error = new Error('Escolha a instância que será vinculada à campanha.');
      setCampaignError(error.message);
      throw error;
    }

    setCampaignError(null);
    setCampaignAction({ id: null, type: 'create' });

    try {
      const payload = await apiPost('/api/campaigns', {
        agreementId: selectedAgreement.id,
        agreementName: selectedAgreement.name,
        instanceId,
        name: normalizedName || `${selectedAgreement.name} • ${instanceId}`,
        status,
      });

      const createdCampaign = payload?.data ?? null;
      if (createdCampaign) {
        setCampaign(createdCampaign);
        onCampaignReady?.(createdCampaign);
      }

      await loadCampaignsRef.current?.();
      toast.success('Campanha criada com sucesso.');
      return createdCampaign;
    } catch (err) {
      if (isAuthError(err)) {
        handleAuthFallback();
        throw err;
      }

      const message =
        err?.payload?.error?.message ||
        (err instanceof Error ? err.message : 'Não foi possível criar a campanha');
      setCampaignError(message);
      logError('Falha ao criar campanha WhatsApp', err);
      toast.error('Falha ao criar campanha', { description: message });
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setCampaignAction(null);
    }
  };

  const updateCampaignStatus = async (target, nextStatus) => {
    if (!target?.id) {
      return;
    }

    setCampaignError(null);
    setCampaignAction({ id: target.id, type: nextStatus });

    try {
      await apiPatch(`/api/campaigns/${encodeURIComponent(target.id)}`, {
        status: nextStatus,
      });

      await loadCampaignsRef.current?.();
      toast.success(
        nextStatus === 'active' ? 'Campanha ativada com sucesso.' : 'Campanha pausada.'
      );
    } catch (err) {
      if (isAuthError(err)) {
        handleAuthFallback();
        throw err;
      }

      const message =
        err?.payload?.error?.message ||
        (err instanceof Error ? err.message : 'Não foi possível atualizar a campanha');
      setCampaignError(message);
      toast.error('Falha ao atualizar campanha', { description: message });
      logError('Falha ao atualizar status da campanha', err);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setCampaignAction(null);
    }
  };

  const deleteCampaign = async (target) => {
    if (!target?.id) {
      return;
    }

    setCampaignError(null);
    setCampaignAction({ id: target.id, type: 'delete' });

    try {
      await apiDelete(`/api/campaigns/${encodeURIComponent(target.id)}`);
      if (campaign?.id === target.id) {
        setCampaign(null);
      }
      await loadCampaignsRef.current?.();
      toast.success('Campanha encerrada com sucesso.');
    } catch (err) {
      if (isAuthError(err)) {
        handleAuthFallback();
        throw err;
      }

      const message =
        err?.payload?.error?.message ||
        (err instanceof Error ? err.message : 'Não foi possível encerrar a campanha');
      setCampaignError(message);
      toast.error('Falha ao encerrar campanha', { description: message });
      logError('Falha ao encerrar campanha WhatsApp', err);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setCampaignAction(null);
    }
  };

  const reassignCampaign = async (target, nextInstanceId) => {
    if (!target?.id) {
      return;
    }
    if (!nextInstanceId) {
      const error = new Error('Selecione a nova instância para prosseguir.');
      setCampaignError(error.message);
      throw error;
    }

    setCampaignError(null);
    setCampaignAction({ id: target.id, type: 'reassign' });

    try {
      await apiPatch(`/api/campaigns/${encodeURIComponent(target.id)}`, {
        instanceId: nextInstanceId,
      });

      await loadCampaignsRef.current?.();
      toast.success('Campanha reatribuída com sucesso.');
    } catch (err) {
      if (isAuthError(err)) {
        handleAuthFallback();
        throw err;
      }

      const message =
        err?.payload?.error?.message ||
        (err instanceof Error ? err.message : 'Não foi possível reatribuir a campanha');
      setCampaignError(message);
      toast.error('Falha ao reatribuir campanha', { description: message });
      logError('Falha ao reatribuir campanha WhatsApp', err);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setCampaignAction(null);
    }
  };

  const fetchCampaignImpact = async (campaignId) => {
    if (!campaignId) {
      return { summary: null };
    }

    try {
      const response = await apiGet(
        `/api/lead-engine/allocations?campaignId=${encodeURIComponent(campaignId)}`
      );
      const summary = response?.meta?.summary ?? null;
      return { summary, items: Array.isArray(response?.data) ? response.data : [] };
    } catch (err) {
      if (isAuthError(err)) {
        handleAuthFallback();
      }
      throw err instanceof Error ? err : new Error('Falha ao carregar impacto da campanha');
    }
  };

  const handleDeleteInstance = async (target) => {
    if (!target?.id) {
      return;
    }

    const agreementId = selectedAgreement?.id;
    setDeletingInstanceId(target.id);
    try {
      const encodedId = encodeURIComponent(target.id);
      const isJid = looksLikeWhatsAppJid(target.id);
      const url = isJid
        ? `/api/integrations/whatsapp/instances/${encodedId}/disconnect`
        : `/api/integrations/whatsapp/instances/${encodedId}`;
      const method = isJid ? 'POST' : 'DELETE';

      log(isJid ? '🔌 Desconectando instância WhatsApp' : '🗑️ Removendo instância WhatsApp', {
        instanceId: target.id,
        agreementId,
        method,
        url,
      });

      if (isJid) {
        await apiPost(url, {});
      } else {
        await apiDelete(url);
      }
      clearInstancesCache(agreementId);
      if (instance?.id === target.id) {
        setInstance(null);
        setLocalStatus('disconnected');
      }
      await loadInstances({ preferredInstanceId: null, forceRefresh: true });
      log(isJid ? '✅ Sessão desconectada' : '✅ Instância removida', {
        instanceId: target.id,
        agreementId,
        method,
        url,
      });
      toast.success(isJid ? 'Sessão desconectada com sucesso' : 'Instância removida com sucesso');
    } catch (err) {
      const friendly = applyErrorMessageFromError(
        err,
        'Não foi possível remover a instância'
      );
      const encodedId = encodeURIComponent(target.id);
      const isJid = looksLikeWhatsAppJid(target.id);
      const url = isJid
        ? `/api/integrations/whatsapp/instances/${encodedId}/disconnect`
        : `/api/integrations/whatsapp/instances/${encodedId}`;
      const method = isJid ? 'POST' : 'DELETE';

      const statusCode =
        typeof err?.response?.status === 'number'
          ? err.response.status
          : typeof err?.status === 'number'
            ? err.status
            : null;
      const responseData = err?.response?.data ?? err?.payload ?? null;
      const errorCode =
        (responseData && typeof responseData === 'object' && responseData !== null
          ? responseData.error?.code || responseData.code
          : null) || err?.code || null;
      const isInstanceMissing =
        statusCode === 404 ||
        errorCode === 'INSTANCE_NOT_FOUND' ||
        errorCode === 'BROKER_INSTANCE_NOT_FOUND';

      if (isInstanceMissing) {
        const nextCurrentId = instance?.id === target.id ? null : instance?.id ?? null;
        warn('Instância não encontrada no servidor; removendo localmente', {
          agreementId,
          instanceId: target.id,
          method,
          url,
          statusCode,
          errorCode,
        });
        clearInstancesCache(agreementId);
        setInstances((prev) => {
          const nextList = Array.isArray(prev)
            ? prev.filter((item) => item && item.id !== target.id)
            : [];
          persistInstancesCache(agreementId, nextList, nextCurrentId);
          return nextList;
        });
        if (instance?.id === target.id) {
          setInstance(null);
          setLocalStatus('disconnected');
        }
        await loadInstances({ preferredInstanceId: nextCurrentId, forceRefresh: true });
        toast.success('Instância removida com sucesso.');
        return;
      }

      logError('Falha ao remover instância WhatsApp', {
        error: err,
        method,
        url,
        instanceId: target.id,
      });

      let bodyPreview = null;
      if (responseData && typeof responseData === 'object') {
        try {
          const serialized = JSON.stringify(responseData);
          bodyPreview = serialized.length > 200 ? `${serialized.slice(0, 197)}…` : serialized;
        } catch (serializationError) {
          console.warn('Não foi possível serializar payload de erro da instância WhatsApp', serializationError);
        }
      }

      const detailParts = [
        `method=${method}`,
        `url=${url}`,
        `id=${target.id}`,
      ];

      if (statusCode !== null) {
        detailParts.push(`status=${statusCode}`);
      }
      if (errorCode) {
        detailParts.push(`code=${errorCode}`);
      }
      if (bodyPreview) {
        detailParts.push(`body=${bodyPreview}`);
      }

      const description = detailParts.join(' • ');
      toast.error('Falha ao remover instância', {
        description: friendly.message ? `${friendly.message} • ${description}` : description,
      });
    } finally {
      setDeletingInstanceId(null);
    }
  };

  useEffect(() => {
    if (!campaign?.instanceId || instances.length === 0) {
      return;
    }

    const matched = instances.find(
      (item) => item.id === campaign.instanceId || item.name === campaign.instanceId
    );

    if (!matched) {
      return;
    }

    setInstance(matched);
    const statusFromInstance = matched.status || 'disconnected';
    setLocalStatus(statusFromInstance);
    onStatusChange?.(statusFromInstance);
  }, [campaign?.instanceId, instances, onStatusChange]);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const generateQr = async (id, { skipConnect = false } = {}) => {
    const myPollId = ++pollIdRef.current;
    setLoadingQr(true);
    setErrorMessage(null);
    try {
      if (!skipConnect) {
        const connectResult = await connectInstance(id);
        const nextStatus =
          connectResult?.status ||
          (typeof connectResult?.connected === 'boolean'
            ? connectResult.connected
              ? 'connected'
              : 'disconnected'
            : null);

        if (nextStatus) {
          setLocalStatus(nextStatus);
          onStatusChange?.(nextStatus);
          setInstance((current) => {
            if (!current || current.id !== id) {
              return current;
            }
            return {
              ...current,
              status: nextStatus,
              connected:
                typeof connectResult?.connected === 'boolean'
                  ? connectResult.connected
                  : nextStatus === 'connected'
                  ? true
                  : typeof current.connected === 'boolean'
                  ? current.connected
                  : false,
            };
          });
          setInstances((prev) =>
            prev.map((item) =>
              item.id === id
                ? {
                    ...item,
                    status: nextStatus,
                    connected:
                      typeof connectResult?.connected === 'boolean'
                        ? connectResult.connected
                        : nextStatus === 'connected'
                        ? true
                        : typeof item.connected === 'boolean'
                        ? item.connected
                        : false,
                  }
                : item
            )
          );
        }

      const connectQr = connectResult?.qr;
      if (connectResult?.connected === false && connectQr?.qrCode) {
        setQrData(connectQr);
        return;
      }

        if (connectResult?.connected) {
          setQrData(null);
          setSecondsLeft(null);
          return;
        }
      }

      setLocalStatus('qr_required');
      onStatusChange?.('disconnected');

      // Polling por até 60s aguardando o QR
      const deadline = Date.now() + 60_000;
      let received = null;
      while (Date.now() < deadline) {
        if (pollIdRef.current !== myPollId) {
          // polling cancelado (nova instância/QR solicitado)
          return;
        }
        let qrResponse = null;
        try {
          qrResponse = await apiGet(
            `/api/integrations/whatsapp/instances/qr?instanceId=${encodeURIComponent(id)}`
          );
          setSessionActive(true);
          setAuthDeferred(false);
        } catch (error) {
          if (isAuthError(error)) {
            handleAuthFallback();
            return;
          }
        }
        const parsed = parseInstancesPayload(qrResponse);
        const qrPayload = parsed.qr;
        if (qrPayload?.qrCode) {
          received = qrPayload;
          break;
        }
        await sleep(1000);
      }

      if (!received) {
        throw new Error('QR não disponível no momento. Tente novamente.');
      }

      setQrData(received);
    } catch (err) {
      if (isAuthError(err)) {
        handleAuthFallback();
      } else {
        applyErrorMessageFromError(err, 'Não foi possível gerar o QR Code');
      }
    } finally {
      setLoadingQr(false);
    }
  };

  const handleInstanceSelect = async (inst, { skipAutoQr = false } = {}) => {
    if (!inst) return;
    setInstance(inst);
    const statusFromInstance = inst.status || 'disconnected';
    setLocalStatus(statusFromInstance);
    onStatusChange?.(statusFromInstance);

    if (campaign && campaign.instanceId !== inst.id) {
      setCampaign(null);
    }

    if (!skipAutoQr && statusFromInstance !== 'connected') {
      ++pollIdRef.current; // invalida qualquer polling anterior
      await generateQr(inst.id);
    } else {
      setQrData(null);
      setSecondsLeft(null);
    }
  };

  const handleViewQr = async (inst) => {
    if (!inst) return;
    await handleInstanceSelect(inst, { skipAutoQr: true });
    await generateQr(inst.id);
    setQrDialogOpen(true);
  };

  const handleGenerateQr = async () => {
    if (!instance) return;
    await generateQr(instance.id);
  };

  const handleMarkConnected = async () => {
    if (!instance?.id) return;
    try {
      // Valida com o servidor, se rota existir
      const status = await apiGet(`/api/integrations/whatsapp/instances/${instance.id}/status`);
      setSessionActive(true);
      setAuthDeferred(false);
      const parsed = parseInstancesPayload(status);
      const connected =
        typeof parsed.connected === 'boolean'
          ? parsed.connected
          : parsed.status === 'connected';

      if (parsed.instance) {
        setInstance((current) =>
          current && current.id === parsed.instance.id ? { ...current, ...parsed.instance } : current
        );
        setInstances((prev) =>
          prev.map((item) =>
            item.id === parsed.instance.id ? { ...item, ...parsed.instance } : item
          )
        );
      }

      if (!connected) {
        setErrorMessage(
          'A instância ainda não está conectada. Escaneie o QR e tente novamente.'
        );
        return;
      }
    } catch (err) {
      if (isAuthError(err)) {
        handleAuthFallback();
        return;
      }
      // Continua em modo otimista caso a rota não exista
    }
    setLocalStatus('connected');
    setQrData(null);
    setSecondsLeft(null);
    setQrDialogOpen(false);
    onStatusChange?.('connected');
  };

  const handleConfirm = () => {
    if (hasCampaign) {
      onContinue?.();
      return;
    }
    setCreateCampaignOpen(true);
  };

  const removalTargetLabel =
    instancePendingDelete?.name ||
    instancePendingDelete?.displayId ||
    instancePendingDelete?.id ||
    'selecionada';
  const removalTargetIsJid = instancePendingDelete?.id
    ? looksLikeWhatsAppJid(instancePendingDelete.id)
    : false;
  const removalDialogTitle = removalTargetIsJid ? 'Desconectar sessão' : 'Remover instância';
  const removalDialogAction = removalTargetIsJid ? 'Desconectar sessão' : 'Remover instância';

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="glass-surface space-y-4 rounded-[var(--radius)] border border-[var(--border)] px-6 py-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-slate-300/80">
              <Badge variant="secondary">{stepLabel}</Badge>
              <span>Próximo: {nextStage}</span>
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Conecte seu WhatsApp</h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Utilize o QR Code para sincronizar o número que você usa com os clientes. Após a conexão, o Lead Engine entrega
                automaticamente os leads aquecidos pelo convênio selecionado.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 text-xs text-muted-foreground">
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${statusTone}`}>
              <span className="font-medium text-foreground/90">{copy.badge}</span>
            </span>
            {hasAgreement ? (
              <span>
                Convênio ativo:{' '}
                <span className="font-medium text-foreground">{selectedAgreement.name}</span>
              </span>
            ) : (
              <span>Selecione um convênio para liberar esta etapa.</span>
            )}
            {countdownMessage ? (
              <span className="flex items-center gap-1 text-amber-200">
                <Clock className="h-3.5 w-3.5" />
                {countdownMessage}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Voltar aos convênios
          </Button>
          <Separator className="section-divider flex-1" />
          <span>{copy.description}</span>
        </div>
      </header>

      {persistentWarning ? (
        <NoticeBanner variant="warning" icon={<AlertTriangle className="h-4 w-4" />}>
          <p>{persistentWarning}</p>
          <p className="text-xs text-amber-200/80">
            Assim que uma campanha ativa for vinculada à instância, os próximos leads inbound serão processados automaticamente.
          </p>
        </NoticeBanner>
      ) : null}

      <div className="space-y-6">
        <Card className="border border-[var(--border)]/60 bg-[rgba(15,23,42,0.5)]">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle>Painel de instâncias</CardTitle>
              <CardDescription>
                Vincule o número certo ao convênio e confirme para avançar para {nextStage}.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <CampaignHistoryDialog agreementId={selectedAgreement?.id} />
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleRefreshInstances()}
                disabled={loadingInstances || !isAuthenticated}
              >
                <RefreshCcw className="mr-2 h-4 w-4" /> Atualizar lista
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void handleCreateInstance()}
                disabled={isBusy || !hasAgreement}
              >
                + Nova instância
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 rounded-[var(--radius)] border border-white/10 bg-white/5 p-4 text-sm">
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Convênio</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {selectedAgreement?.name ?? 'Selecione um convênio'}
                  </p>
                  {selectedAgreement?.region ? (
                    <p className="text-xs text-muted-foreground">{selectedAgreement.region}</p>
                  ) : null}
                </div>
                <div className="max-w-[260px] sm:max-w-full">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Instância selecionada</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {instance?.name || instance?.id || 'Escolha uma instância'}
                    </p>
                    {selectedInstanceStatusInfo ? (
                      <Badge variant={selectedInstanceStatusInfo.variant} className="px-2 py-0 text-[0.65rem]">
                        {selectedInstanceStatusInfo.label}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {instance ? `Telefone: ${formatPhoneNumber(selectedInstancePhone)}` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Campanha</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {hasCampaign ? campaign.name : 'Será criada após a confirmação'}
                  </p>
                  {hasCampaign && campaign.updatedAt ? (
                    <p className="text-xs text-muted-foreground">
                      Atualizada em {new Date(campaign.updatedAt).toLocaleString('pt-BR')}
                    </p>
                  ) : hasCampaign ? (
                    <p className="text-xs text-muted-foreground">
                      Instância vinculada: {campaign.instanceName || campaign.instanceId}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Será ligada ao número selecionado.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-300/70">
                <span>Instâncias disponíveis</span>
                <span>{instancesCountLabel}</span>
              </div>
              {!instancesReady ? (
                <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                  {Array.from({ length: 2 }).map((_, index) => (
                    <div
                      key={index}
                      className="flex h-full w-full flex-col rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="mt-2 h-4 w-1/2" />
                      <Skeleton className="mt-2 h-4 w-2/3" />
                      <div className="mt-4 grid gap-2">
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                      </div>
                      <Skeleton className="mt-4 h-10 w-24" />
                    </div>
                  ))}
                </div>
              ) : instanceCount > 0 ? (
                <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                  {instances.map((item, index) => {
                    const isCurrent = instance?.id === item.id;
                    const statusInfo = getStatusInfo(item);
                    const metrics = getInstanceMetrics(item);
                    const statusValues = metrics.status || {};
                    const rateUsage = metrics.rateUsage || { used: 0, limit: 0, remaining: 0, percentage: 0 };
                    const ratePercentage = Math.max(0, Math.min(100, rateUsage.percentage ?? 0));
                    const phoneLabel = resolveInstancePhone(item);
                    const addressLabel = item.address || item.jid || item.session || '';
                    const lastUpdated = item.updatedAt || item.lastSeen || item.connectedAt;
                    const lastUpdatedLabel = lastUpdated
                      ? new Date(lastUpdated).toLocaleString('pt-BR')
                      : '—';

                    return (
                      <div
                        key={item.id || item.name || index}
                        className={cn(
                          'flex h-full w-full flex-col rounded-2xl border p-4 transition-colors',
                          isCurrent
                            ? 'border-primary/60 bg-primary/10 shadow-[0_0_0_1px_rgba(99,102,241,0.45)]'
                            : 'border-white/10 bg-white/5 hover:border-primary/30'
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">{item.name || item.id}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatPhoneNumber(phoneLabel) || '—'}
                        </p>
                        {addressLabel && addressLabel !== phoneLabel ? (
                          <p className="text-xs text-muted-foreground">{addressLabel}</p>
                        ) : null}
                      </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Remover instância"
                            title="Remover instância"
                            disabled={deletingInstanceId === item.id}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setInstancePendingDelete(item);
                            }}
                          >
                            {deletingInstanceId === item.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                          <div className="grid grid-cols-1 gap-2 text-center sm:grid-cols-3">
                            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                              <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Enviadas</p>
                              <p className="mt-1 text-base font-semibold text-foreground">
                                {formatMetricValue(metrics.sent)}
                              </p>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                              <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Na fila</p>
                              <p className="mt-1 text-base font-semibold text-foreground">
                                {formatMetricValue(metrics.queued)}
                              </p>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                              <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Falhas</p>
                              <p className="mt-1 text-base font-semibold text-foreground">
                                {formatMetricValue(metrics.failed)}
                              </p>
                            </div>
                          </div>

                          <div className="grid gap-2 text-center sm:grid-cols-3 lg:grid-cols-5">
                            {statusCodeMeta.map((meta) => (
                              <div
                                key={meta.code}
                                className="rounded-lg border border-white/10 bg-white/5 p-3"
                                title={meta.description}
                              >
                                <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                                  {meta.label}
                                </p>
                                <p className="mt-1 text-base font-semibold text-foreground">
                                  {formatMetricValue(statusValues[meta.code])}
                                </p>
                              </div>
                            ))}
                          </div>

                          <div
                            className="rounded-lg border border-white/10 bg-white/5 p-3 text-left"
                            title="Uso do limite de envio reportado pelo broker."
                          >
                            <div className="flex items-center justify-between text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                              <span>Utilização do limite</span>
                              <span>{ratePercentage}%</span>
                            </div>
                            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${ratePercentage}%` }}
                              />
                            </div>
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                              <span>Usadas: {formatMetricValue(rateUsage.used)}</span>
                              <span>Disponível: {formatMetricValue(rateUsage.remaining)}</span>
                              <span>Limite: {formatMetricValue(rateUsage.limit)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span>Atualizado: {lastUpdatedLabel}</span>
                          {item.user ? <span>Operador: {item.user}</span> : null}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant={isCurrent ? 'default' : 'outline'}
                            onClick={() => void handleInstanceSelect(item)}
                            disabled={isBusy}
                          >
                            {isCurrent ? 'Instância selecionada' : 'Selecionar'}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void handleViewQr(item)}
                            disabled={isBusy || !isAuthenticated}
                          >
                            <QrCode className="mr-2 h-3.5 w-3.5" /> Ver QR
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">
                  <p>Nenhuma instância encontrada. Crie uma nova para iniciar a sincronização com o convênio selecionado.</p>
                  <Button
                    size="sm"
                    className="mt-4"
                    onClick={() => void handleCreateInstance()}
                    disabled={isBusy || !hasAgreement || !isAuthenticated}
                  >
                    Criar instância agora
                  </Button>
                </div>
              )}
            </div>

            {errorState ? (
              <div className="flex flex-wrap items-start gap-3 rounded-[var(--radius)] border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                <div className="flex-1 space-y-1">
                  <p className="font-medium">{errorState.title ?? 'Algo deu errado'}</p>
                  <p>{errorState.message}</p>
                  {errorState.requiresAuth ? (
                    <p className="text-[0.7rem] text-muted-foreground">
                      O botão “Login demo” abre o DemoAuthDialog para gerar o token necessário.
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {errorState.requiresAuth ? (
                    <DemoAuthDialog />
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void loadInstances({ forceRefresh: true })}
                    disabled={errorState.requiresAuth}
                  >
                    Tentar novamente
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
          <CardFooter className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link2 className="h-4 w-4" />
              Status atual: <span className="font-medium text-foreground">{copy.badge}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {localStatus !== 'connected' ? (
                <Button onClick={handleMarkConnected} disabled={isBusy || !isAuthenticated}>
                  Marcar como conectado
                </Button>
              ) : null}
              <Button onClick={() => void handleConfirm()} disabled={confirmDisabled}>
                {confirmLabel}
              </Button>
            </div>
          </CardFooter>
        </Card>
        <CampaignsPanel
          agreementName={selectedAgreement?.name ?? null}
          campaigns={campaigns}
          loading={campaignsLoading}
          error={campaignError}
          onRefresh={() => void loadCampaignsRef.current?.()}
          onCreateClick={() => setCreateCampaignOpen(true)}
          onPause={(entry) => void updateCampaignStatus(entry, 'paused')}
          onActivate={(entry) => void updateCampaignStatus(entry, 'active')}
          onDelete={(entry) => void deleteCampaign(entry)}
          onReassign={(entry) => setPendingReassign(entry)}
          actionState={campaignAction}
          selectedInstanceId={instance?.id ?? null}
        />
        <Card className="border border-[var(--border)]/60 bg-[rgba(15,23,42,0.35)]">
          <Collapsible open={qrPanelOpen} onOpenChange={setQrPanelOpen}>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5" />
                  QR Code e instruções
                </CardTitle>
                <CardDescription>Escaneie com o aplicativo oficial para ativar a sessão.</CardDescription>
              </div>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'ml-auto inline-flex items-center gap-2 text-xs uppercase tracking-wide transition-transform',
                    qrPanelOpen ? 'rotate-180' : ''
                  )}
                >
                  <ChevronDown className="h-4 w-4" />
                  {qrPanelOpen ? 'Recolher' : 'Expandir'}
                </Button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-6">
                <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-white/10 bg-white/5 p-6">
                  <div className="flex h-44 w-44 items-center justify-center rounded-2xl border border-[rgba(99,102,241,0.25)] bg-[rgba(99,102,241,0.08)] text-primary shadow-inner">
                    {hasQr ? (
                      <img src={qrImageSrc} alt="QR Code do WhatsApp" className="h-36 w-36 rounded-lg shadow-inner" />
                    ) : isGeneratingQrImage ? (
                      <Loader2 className="h-12 w-12 animate-spin" />
                    ) : (
                      <QrCode className="h-24 w-24" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status" aria-live="polite">
                    <Clock className="h-3.5 w-3.5" />
                    {qrStatusMessage}
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleGenerateQr()}
                      disabled={isBusy || !instance || !isAuthenticated}
                    >
                      <RefreshCcw className="mr-2 h-4 w-4" /> Gerar novo QR
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setQrDialogOpen(true)}
                      disabled={!hasQr}
                    >
                      Abrir em tela cheia
                    </Button>
                  </div>
                </div>

                <div className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                    <p>Use o número que já interage com os clientes. Não é necessário chip ou aparelho adicional.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                    <p>O Lead Engine garante distribuição automática. Você só recebe quando o servidor responde “quero falar”.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                    <p>Se perder a conexão, repita o processo — seus leads permanecem reservados na sua inbox.</p>
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-300/70">
                    <span className="flex items-center gap-2">
                      <History className="h-4 w-4" /> Atividade recente
                    </span>
                    <span className={cn('text-[0.65rem]', realtimeConnected ? 'text-emerald-300' : 'text-muted-foreground')}>
                      {realtimeConnected ? 'Tempo real ativo' : 'Tempo real offline'}
                    </span>
                  </div>
                  {timelineItems.length > 0 ? (
                    <ul className="space-y-2 text-sm">
                      {timelineItems.map((item) => (
                        <li
                          key={item.id}
                          className="flex flex-wrap justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                        >
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">{humanizeLabel(item.type)}</p>
                            {item.status ? (
                              <p className="text-xs text-muted-foreground">
                                Status: {humanizeLabel(item.status)}
                                {typeof item.connected === 'boolean'
                                  ? ` • ${item.connected ? 'Conectado' : 'Desconectado'}`
                                  : ''}
                              </p>
                            ) : null}
                            {item.phoneNumber ? (
                              <p className="text-xs text-muted-foreground">
                                Telefone: {formatPhoneNumber(item.phoneNumber)}
                              </p>
                            ) : null}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatTimestampLabel(item.timestamp)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Aguardando atividades desta instância. As sincronizações e mudanças de status aparecem aqui em tempo real.
                    </p>
                  )}
                </div>
              </CardContent>
              <CardFooter className="rounded-lg bg-muted/40 px-6 py-4 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Dica para evitar bloqueios</p>
                <p className="mt-1">
                  Mantenha o aplicativo oficial aberto e responda às mensagens em até 15 minutos. A inteligência do Lead Engine cuida do aquecimento automático do número.
                </p>
              </CardFooter>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      </div>

      <CreateInstanceDialog
        open={isCreateInstanceOpen}
        onOpenChange={setCreateInstanceOpen}
        defaultName={`Instância ${instances.length + 1}`}
        onSubmit={async (payload) => {
          await submitCreateInstance(payload);
        }}
      />

      <CreateCampaignDialog
        open={isCreateCampaignOpen}
        onOpenChange={setCreateCampaignOpen}
        agreement={selectedAgreement}
        instances={instances}
        defaultInstanceId={instance?.id ?? null}
        onSubmit={async (payload) => {
          await createCampaign(payload);
        }}
      />

      <ReassignCampaignDialog
        open={Boolean(pendingReassign)}
        campaign={pendingReassign}
        instances={instances}
        onClose={(open) => {
          if (!open) {
            setPendingReassign(null);
          }
        }}
        onSubmit={async ({ instanceId }) => {
          if (!pendingReassign) {
            return;
          }
          await reassignCampaign(pendingReassign, instanceId);
          setPendingReassign(null);
        }}
        fetchImpact={fetchCampaignImpact}
      />

      <AlertDialog
        open={Boolean(instancePendingDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setInstancePendingDelete(null);
          }
        }}
      >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{removalDialogTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {removalTargetIsJid ? (
              <>
                Esta ação desconecta a sessão <strong>{removalTargetLabel}</strong>. Utilize quando precisar encerrar um
                dispositivo sincronizado com o broker.
              </>
            ) : (
              <>
                Esta ação remove permanentemente a instância <strong>{removalTargetLabel}</strong>. Verifique se não há
                campanhas ativas utilizando este número.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setInstancePendingDelete(null)}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              if (!instancePendingDelete) return;
              await handleDeleteInstance(instancePendingDelete);
              setInstancePendingDelete(null);
            }}
          >
            {removalDialogAction}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

      <Dialog open={isQrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Escaneie o QR Code</DialogTitle>
            <DialogDescription>
              Use o aplicativo do WhatsApp para escanear o código abaixo e vincular esta instância com o LeadEngine.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-64 w-64 items-center justify-center rounded-2xl border border-[rgba(99,102,241,0.25)] bg-[rgba(99,102,241,0.08)] text-primary shadow-inner">
              {hasQr ? (
                <img src={qrImageSrc} alt="QR Code do WhatsApp" className="h-56 w-56 rounded-lg shadow-inner" />
              ) : isGeneratingQrImage ? (
                <Loader2 className="h-16 w-16 animate-spin" />
              ) : (
                <QrCode className="h-32 w-32" />
              )}
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Abra o WhatsApp &gt; Configurações &gt; Dispositivos Conectados &gt; Conectar dispositivo e escaneie o QR Code exibido.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WhatsAppConnect;
