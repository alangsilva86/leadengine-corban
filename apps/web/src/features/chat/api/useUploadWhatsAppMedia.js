import { useMutation } from '@tanstack/react-query';
import { apiUpload } from '@/lib/api.js';

const normalizeDescriptor = (payload = {}, fallback = {}) => {
  const mediaUrl = typeof payload.mediaUrl === 'string' ? payload.mediaUrl : fallback.mediaUrl;
  const mimeType =
    typeof payload.mimeType === 'string'
      ? payload.mimeType
      : typeof payload.mediaMimeType === 'string'
        ? payload.mediaMimeType
        : fallback.mimeType;
  const fileName =
    typeof payload.fileName === 'string'
      ? payload.fileName
      : typeof payload.mediaFileName === 'string'
        ? payload.mediaFileName
        : fallback.fileName;
  const size =
    typeof payload.size === 'number'
      ? payload.size
      : typeof payload.mediaSize === 'number'
        ? payload.mediaSize
        : fallback.size;

  return {
    mediaUrl,
    mimeType,
    fileName,
    size,
  };
};

export const useUploadWhatsAppMedia = () => {
  return useMutation({
    mutationKey: ['chat', 'whatsapp', 'upload-media'],
    mutationFn: async ({ file, fileName, mimeType } = {}) => {
      if (!file) {
        throw new Error('Arquivo obrigatório para upload.');
      }

      const inferredName =
        fileName || (typeof file.name === 'string' && file.name.length > 0 ? file.name : undefined);
      const inferredMime =
        mimeType || (typeof file.type === 'string' && file.type.length > 0 ? file.type : undefined);

      const formData = new FormData();
      formData.append('file', file);
      if (inferredName) {
        formData.append('fileName', inferredName);
      }
      if (inferredMime) {
        formData.append('mimeType', inferredMime);
      }

      const response = await apiUpload('/api/whatsapp/uploads', formData);
      const data = response?.data ?? response;

      const descriptor = normalizeDescriptor(data, {
        mediaUrl: null,
        mimeType: inferredMime ?? 'application/octet-stream',
        fileName: inferredName ?? 'upload.bin',
        size: typeof file.size === 'number' ? file.size : undefined,
      });

      if (!descriptor.mediaUrl) {
        throw new Error('Resposta inválida do provedor de upload.');
      }

      return descriptor;
    },
  });
};

export default useUploadWhatsAppMedia;
