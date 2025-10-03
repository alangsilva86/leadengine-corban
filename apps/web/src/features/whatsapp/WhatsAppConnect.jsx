import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
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
} from 'lucide-react';
import { cn } from '@/lib/utils.js';
import { apiDelete, apiGet, apiPost } from '@/lib/api.js';
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
  } catch (_error) {
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
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [isQrDialogOpen, setQrDialogOpen] = useState(false);
  const [deletingInstanceId, setDeletingInstanceId] = useState(null);
  const [instancePendingDelete, setInstancePendingDelete] = useState(null);
  const [liveEvents, setLiveEvents] = useState([]);
  const loadInstancesRef = useRef(() => {});
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
    setErrorMessage(requireAuthMessage, { requiresAuth: true });
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
      setErrorState({ message, ...meta });
    } else {
      setErrorState(null);
    }
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
  const confirmLabel = hasCampaign
    ? 'Ir para a inbox de leads'
    : creatingCampaign
    ? 'Sincronizando…'
    : 'Confirmar e criar campanha';
  const confirmDisabled =
    creatingCampaign || (!hasCampaign && (!canContinue || isBusy)) || !isAuthenticated;
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
        const existing = Array.isArray(response?.data) ? response.data[0] : null;
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
    const response = await apiPost('/api/integrations/whatsapp/instances/connect', instanceId ? { instanceId } : {});
    setSessionActive(true);
    setAuthDeferred(false);
    const payload = response?.data ?? {};
    const instanceFromPayload = extractInstanceFromPayload(payload) || null;

    let status = typeof payload.status === 'string' ? payload.status : null;
    if (!status && typeof instanceFromPayload?.status === 'string') {
      status = instanceFromPayload.status;
    }

    const hasConnectedFlag = typeof payload.connected === 'boolean';
    let connected = hasConnectedFlag
      ? payload.connected
      : typeof instanceFromPayload?.connected === 'boolean'
      ? instanceFromPayload.connected
      : null;
    if (connected === null && status) {
      connected = status === 'connected';
    }

    const resolvedInstanceId =
      typeof payload.instanceId === 'string' && payload.instanceId
        ? payload.instanceId
        : instanceId || instanceFromPayload?.id || instanceFromPayload?.instanceId || null;

    let instance = instanceFromPayload;
    if (!instance && resolvedInstanceId) {
      instance = {
        id: resolvedInstanceId,
        status,
        connected,
      };
    } else if (instance && resolvedInstanceId && !instance.id) {
      instance = { ...instance, id: resolvedInstanceId };
    }

    const instances = Array.isArray(payload.instances)
      ? payload.instances.filter((item) => item && typeof item === 'object')
      : [];

    return {
      instanceId: resolvedInstanceId,
      status,
      connected,
      qr: extractQrPayload(payload),
      instance,
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
        typeof forceRefresh === 'boolean' ? forceRefresh : !hasFetchedOnceRef.current;

      log('🛰️ Solicitando lista de instâncias', {
        agreementId,
        forceRefresh: shouldForceBrokerSync,
        hasFetchedOnce: hasFetchedOnceRef.current,
      });
      const response = await apiGet(
        `/api/integrations/whatsapp/instances${shouldForceBrokerSync ? '?refresh=1' : ''}`
      );
      const hasServerList = Array.isArray(response?.data);
      setSessionActive(true);
      setAuthDeferred(false);
      let list = hasServerList ? response.data : [];
      let connectResult = providedConnect || null;

      if (Array.isArray(list) && list.length === 0) {
        const refreshed = await apiGet('/api/integrations/whatsapp/instances?refresh=1').catch(
          () => null
        );
        const refreshedList = Array.isArray(refreshed?.data) ? refreshed.data : [];
        if (refreshedList.length > 0) {
          list = refreshedList;
        }
      }

      if (!Array.isArray(list) || list.length === 0) {
        const fallbackInstanceId = preferredInstanceId || campaign?.instanceId || null;
        connectResult = connectResult || (await connectInstance(fallbackInstanceId));

        if (connectResult?.instances?.length) {
          list = connectResult.instances;
        } else if (connectResult?.instance) {
          list = [connectResult.instance];
        } else {
      const refreshed = await apiGet('/api/integrations/whatsapp/instances?refresh=1').catch(
        () => null
      );
      const refreshedList = Array.isArray(refreshed?.data) ? refreshed.data : [];
      if (refreshedList.length > 0) {
        list = refreshedList;
      }
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

      if (current && connectResult?.status) {
        const merged = {
          ...current,
          status: connectResult.status,
          connected:
            connectResult.connected ?? (typeof current.connected === 'boolean' ? current.connected : false),
        };
        current = merged;
        list = list.map((item) => (item.id === merged.id ? { ...item, ...merged } : item));
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

      const connectQr = extractQrPayload(connectResult);
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
      if (isAuthError(err)) {
        handleAuthFallback();
      } else {
        setErrorMessage(
          err instanceof Error ? err.message : 'Não foi possível carregar status do WhatsApp'
        );
      }
      warn('Instâncias não puderam ser carregadas', err);
      return { success: false, error: err, skipped: isAuthError(err) };
    } finally {
      setLoadingInstances(false);
      setInstancesReady(true);
    }
  };
  loadInstancesRef.current = loadInstances;

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

  const handleCreateInstance = async () => {
    if (!selectedAgreement) return;

    const defaultName = `Instância ${instances.length + 1}`;
    let providedName = defaultName;
    if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
      const promptValue = window.prompt(
        'Como deseja chamar a nova instância do WhatsApp?',
        defaultName
      );
      if (promptValue === null) {
        return;
      }
      providedName = promptValue;
    }

    const normalizedName = `${providedName ?? ''}`.trim();
    if (!normalizedName) {
      setErrorMessage('Informe um nome válido para a nova instância.');
      return;
    }

    setLoadingInstances(true);
    setErrorMessage(null);
    try {
      log('🧪 Criando nova instância WhatsApp', {
        agreementId: selectedAgreement.id,
        name: normalizedName,
      });
      const response = await apiPost('/api/integrations/whatsapp/instances', {
        name: normalizedName,
      });
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
    } catch (err) {
      if (isAuthError(err)) {
        handleAuthFallback();
      } else {
        setErrorMessage(
          err instanceof Error ? err.message : 'Não foi possível criar uma nova instância'
        );
      }
      logError('Falha ao criar instância WhatsApp', err);
    } finally {
      setLoadingInstances(false);
    }
  };

  const handleDeleteInstance = async (target) => {
    if (!target?.id) {
      return;
    }

    const agreementId = selectedAgreement?.id;
    setDeletingInstanceId(target.id);
    try {
      log('🗑️ Removendo instância WhatsApp', {
        instanceId: target.id,
        agreementId,
      });
      await apiDelete(`/api/integrations/whatsapp/instances/${encodeURIComponent(target.id)}`);
      clearInstancesCache(agreementId);
      if (instance?.id === target.id) {
        setInstance(null);
        setLocalStatus('disconnected');
      }
      await loadInstances({ preferredInstanceId: null, forceRefresh: true });
      log('✅ Instância removida', {
        instanceId: target.id,
        agreementId,
      });
    } catch (err) {
      const message =
        err?.payload?.error?.message ||
        (err instanceof Error ? err.message : 'Não foi possível remover a instância');
      setErrorMessage(message);
      logError('Falha ao remover instância WhatsApp', err);
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

       const connectQr = extractQrPayload(connectResult);
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
        const parsed = extractQrPayload(qrResponse?.data);
        if (parsed?.qrCode) {
          received = parsed;
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
        setErrorMessage(err instanceof Error ? err.message : 'Não foi possível gerar o QR Code');
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
      const connected = Boolean(status?.data?.connected);
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

  const handleContinue = async () => {
    if (localStatus !== 'connected' || !instance || !selectedAgreement) return;

    setCreatingCampaign(true);
    setErrorMessage(null);

    try {
      const payload = await apiPost('/api/campaigns', {
        agreementId: selectedAgreement.id,
        agreementName: selectedAgreement.name,
        instanceId: instance.id,
        name: `${selectedAgreement.name} • ${instance.name || instance.id}`,
        status: 'active',
      });

      const createdCampaign = payload?.data || null;
      if (createdCampaign) {
        setCampaign(createdCampaign);
        onCampaignReady?.(createdCampaign);
      }

      onContinue?.();
    } catch (err) {
      const errorCode = err?.payload?.error?.code;
      const messageFallback =
        err?.payload?.error?.message ||
        err?.message ||
        (err instanceof Error ? err.message : 'Não foi possível salvar a campanha');

      if (errorCode === 'CAMPAIGN_NAME_IN_USE') {
        try {
          const response = await apiGet(
            `/api/campaigns?agreementId=${encodeURIComponent(selectedAgreement.id)}&instanceId=${encodeURIComponent(instance.id)}&status=active`
          );
          const existingCampaign = Array.isArray(response?.data) ? response.data[0] : null;

          if (existingCampaign) {
            setCampaign(existingCampaign);
            onCampaignReady?.(existingCampaign);
            onContinue?.();
            setErrorMessage(null);
            return;
          }
        } catch (fetchError) {
          logError('Falha ao recuperar campanha existente', fetchError);
        }
      }

      setErrorMessage(messageFallback);
      logError('Falha ao criar campanha WhatsApp', err);
    } finally {
      setCreatingCampaign(false);
    }
  };

  const handleConfirm = async () => {
    if (hasCampaign) {
      onContinue?.();
      return;
    }
    await handleContinue();
  };

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
                  <p className="font-medium">Algo deu errado</p>
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
            <AlertDialogTitle>Remover instância</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove permanentemente a instância{' '}
              <strong>{instancePendingDelete?.name || instancePendingDelete?.id || 'selecionada'}</strong>. Conferir se não há campanhas ativas utilizando este número.
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
              Remover instância
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isQrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Escaneie o QR Code</DialogTitle>
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
