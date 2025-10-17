import { useEffect, useMemo, useRef, useState } from 'react';
import { toDataURL as generateQrDataUrl } from 'qrcode';

import { getQrImageSrc } from '../utils/qr.js';

const qrImageCache = new Map();

const getCacheKey = (code) => {
  if (typeof code !== 'string') {
    return null;
  }
  const normalized = code.trim();
  return normalized ? normalized : null;
};

const buildError = (error) => {
  if (error instanceof Error) {
    return error;
  }
  return new Error(typeof error === 'string' ? error : 'Falha ao gerar QR Code');
};

const QR_OPTIONS = { type: 'image/png', errorCorrectionLevel: 'M', margin: 1 };

export default function useQrImageSource(qrPayload) {
  const qrMeta = useMemo(() => getQrImageSrc(qrPayload), [qrPayload]);
  const { code, immediate, needsGeneration } = qrMeta;
  const cacheKey = getCacheKey(code);

  const cachedSrc = useMemo(() => {
    if (immediate) {
      return immediate;
    }
    if (cacheKey && qrImageCache.has(cacheKey)) {
      return qrImageCache.get(cacheKey) ?? null;
    }
    return null;
  }, [cacheKey, immediate]);

  const [src, setSrc] = useState(cachedSrc);
  const [isGenerating, setIsGenerating] = useState(
    Boolean(!cachedSrc && needsGeneration && cacheKey && !immediate)
  );
  const [error, setError] = useState(null);
  const lastRequestedCodeRef = useRef(cacheKey);

  useEffect(() => {
    lastRequestedCodeRef.current = cacheKey;
  }, [cacheKey]);

  useEffect(() => {
    let cancelled = false;

    setError(null);

    if (immediate) {
      setSrc(immediate);
      setIsGenerating(false);
      if (cacheKey) {
        qrImageCache.set(cacheKey, immediate);
      }
      return () => {
        cancelled = true;
      };
    }

    if (!needsGeneration || !cacheKey) {
      setSrc(null);
      setIsGenerating(false);
      return () => {
        cancelled = true;
      };
    }

    if (qrImageCache.has(cacheKey)) {
      const cachedValue = qrImageCache.get(cacheKey) ?? null;
      setSrc(cachedValue);
      setIsGenerating(false);
      return () => {
        cancelled = true;
      };
    }

    setSrc(null);
    setIsGenerating(true);

    let settled = false;

    generateQrDataUrl(cacheKey, QR_OPTIONS)
      .then((url) => {
        if (cancelled) {
          return;
        }
        settled = true;
        qrImageCache.set(cacheKey, url);
        setSrc(url);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        settled = true;
        const normalizedError = buildError(err);
        console.error('Falha ao gerar QR Code', normalizedError);
        qrImageCache.delete(cacheKey);
        setSrc(null);
        setError(normalizedError);
      })
      .finally(() => {
        if (cancelled) {
          return;
        }
        if (settled || lastRequestedCodeRef.current === cacheKey) {
          setIsGenerating(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, immediate, needsGeneration]);

  return {
    src,
    isGenerating,
    error,
    meta: qrMeta,
  };
}

export const __testing = {
  clearCache: () => qrImageCache.clear(),
  getCacheSnapshot: () => new Map(qrImageCache),
};
