import type { QrImageMeta } from '../utils/qr.js';

export interface QrImageSourceResult {
  src: string | null;
  isGenerating: boolean;
  error: Error | null;
  meta: QrImageMeta;
}

declare function useQrImageSource(payload: unknown): QrImageSourceResult;

export default useQrImageSource;

export type { QrImageSourceResult };
