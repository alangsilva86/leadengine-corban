import type { NormalizedInboundMessage } from '../../utils/normalize';
import { readNullableNumber, readNullableString, RAW_MEDIA_MESSAGE_KEYS, toRecord } from './helpers';

const pickString = (...candidates: unknown[]): string | null => {
  for (const candidate of candidates) {
    const value = readNullableString(candidate);
    if (value) return value;
  }
  return null;
};

const pickNumber = (...candidates: unknown[]): number | null => {
  for (const candidate of candidates) {
    const value = readNullableNumber(candidate);
    if (value !== null) return value;
  }
  return null;
};

export const collectMediaRecords = (
  message: NormalizedInboundMessage,
  metadataRecord: Record<string, unknown>
): Record<string, unknown>[] => {
  const visited = new Set<Record<string, unknown>>();
  const records: Record<string, unknown>[] = [];

  const pushRecord = (value: unknown): void => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const record = value as Record<string, unknown>;
    if (visited.has(record)) return;
    visited.add(record);
    records.push(record);
    for (const key of ['media', 'attachment', 'file']) {
      if (key in record) pushRecord((record as any)[key]);
    }
  };

  const rawRecord = message.raw as Record<string, unknown>;
  pushRecord(rawRecord);
  pushRecord((rawRecord as any).metadata);
  pushRecord((rawRecord as any).message);
  pushRecord((rawRecord as any).imageMessage);
  pushRecord((rawRecord as any).videoMessage);
  pushRecord((rawRecord as any).audioMessage);
  pushRecord((rawRecord as any).documentMessage);
  pushRecord((rawRecord as any).stickerMessage);
  pushRecord(metadataRecord);
  if (metadataRecord.media && typeof metadataRecord.media === 'object' && !Array.isArray(metadataRecord.media)) {
    pushRecord(metadataRecord.media);
  }

  return records;
};

export const resolveRawMediaKey = (
  message: NormalizedInboundMessage
): (typeof RAW_MEDIA_MESSAGE_KEYS)[number] | null => {
  const rawRecord = message.raw as Record<string, unknown>;
  const candidateSources: Array<Record<string, unknown> | null> = [
    rawRecord,
    (rawRecord.message && typeof (rawRecord as any).message === 'object' && !Array.isArray((rawRecord as any).message)
      ? (rawRecord as any).message
      : null),
  ];
  for (const source of candidateSources) {
    if (!source) continue;
    for (const key of RAW_MEDIA_MESSAGE_KEYS) {
      if (key in source && (source as any)[key] && typeof (source as any)[key] === 'object') {
        return key;
      }
    }
  }
  return null;
};

export const extractMediaDownloadDetails = (
  message: NormalizedInboundMessage,
  metadataRecord: Record<string, unknown>
) => {
  const records = collectMediaRecords(message, metadataRecord);

  const directPathCandidate = pickString(
    ...(message.mediaUrl ? ([message.mediaUrl] as unknown[]) : []),
    ...records.flatMap((record) => [
      record['directPath'], record['direct_path'],
      record['downloadUrl'], record['download_url'],
      record['mediaUrl'], record['media_url'],
      record['url'],
    ])
  );

  const mediaKey = pickString(
    ...records.flatMap((record) => [
      record['mediaKey'], record['media_key'],
      record['fileSha256'], record['file_sha256'],
      record['mediaKeyTimestamp'],
    ])
  );

  const fileName = pickString(
    ...records.flatMap((record) => [
      record['fileName'], record['filename'], record['file_name'],
      record['fileNameEncryptedSha256'],
      record['name'], record['originalFilename'],
    ])
  );

  const mimeType = pickString(
    message.mimetype,
    ...records.flatMap((record) => [
      record['mimeType'], record['mimetype'],
      record['contentType'], record['content_type'],
      record['type'],
    ])
  );

  const size = pickNumber(
    message.fileSize,
    ...records.flatMap((record) => [record['fileLength'], record['file_length'], record['size'], record['length']])
  );

  return {
    directPath: directPathCandidate && !/^https?:\/\//i.test(directPathCandidate) ? directPathCandidate : null,
    mediaKey: mediaKey ?? null,
    fileName: fileName ?? null,
    mimeType: mimeType ?? null,
    size: size ?? null,
    raw: message.raw,
    rawKey: resolveRawMediaKey(message),
  };
};
