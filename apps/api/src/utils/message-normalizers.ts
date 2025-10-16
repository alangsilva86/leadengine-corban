const normalizeString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    if (typeof value === 'number' || typeof value === 'boolean') {
      const normalized = String(value).trim();
      return normalized.length > 0 ? normalized : null;
    }
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeString(entry))
      .filter((entry): entry is string => Boolean(entry));
  }

  const single = normalizeString(value);
  return single ? [single] : [];
};

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const clampCoordinate = (value: number, min: number, max: number): number | null => {
  if (!Number.isFinite(value)) {
    return null;
  }
  if (value < min || value > max) {
    return null;
  }
  return value;
};

export const normalizeLocationPayload = (
  input: unknown
): { latitude: number; longitude: number; name?: string; address?: string } | null => {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const record = input as Record<string, unknown>;
  const latitudeCandidate =
    record.latitude ?? record.lat ?? record.latDeg ?? record.latDegrees ?? record.y ?? record.latitudeDeg;
  const longitudeCandidate =
    record.longitude ?? record.lng ?? record.lon ?? record.long ?? record.x ?? record.longitudeDeg;

  const latitudeValue = toFiniteNumber(latitudeCandidate);
  const longitudeValue = toFiniteNumber(longitudeCandidate);

  if (latitudeValue === null || longitudeValue === null) {
    return null;
  }

  const latitude = clampCoordinate(latitudeValue, -90, 90);
  const longitude = clampCoordinate(longitudeValue, -180, 180);

  if (latitude === null || longitude === null) {
    return null;
  }

  const name =
    normalizeString(record.name ?? record.label ?? record.description ?? record.title ?? record.placeName) ?? undefined;
  const address =
    normalizeString(record.address ?? record.location ?? record.place ?? record.addressLine) ?? undefined;

  const normalized: { latitude: number; longitude: number; name?: string; address?: string } = {
    latitude,
    longitude,
  };

  if (name) {
    normalized.name = name;
  }
  if (address) {
    normalized.address = address;
  }

  return normalized;
};

const normalizeContactEntry = (input: unknown): Record<string, unknown> | null => {
  if (typeof input === 'string') {
    const vcard = normalizeString(input);
    return vcard ? { vcard } : null;
  }

  if (!input || typeof input !== 'object') {
    return null;
  }

  const record = input as Record<string, unknown>;

  const vcard =
    normalizeString(record.vcard ?? record.vCard ?? record.vCardRaw ?? record.vcardRaw ?? record.vcardText) ?? undefined;
  const name =
    normalizeString(
      record.name ?? record.displayName ?? record.fullName ?? record.formattedName ?? record.firstName ?? record.givenName
    ) ?? undefined;
  const lastName = normalizeString(record.lastName ?? record.familyName) ?? undefined;
  const organization = normalizeString(record.organization ?? record.org ?? record.company ?? record.businessName) ?? undefined;
  const title = normalizeString(record.title ?? record.jobTitle ?? record.role) ?? undefined;
  const phones = normalizeStringArray(record.phones ?? record.phone ?? record.phoneNumbers ?? record.numbers);
  const emails = normalizeStringArray(record.emails ?? record.email ?? record.emailAddresses);
  const urls = normalizeStringArray(record.urls ?? record.url ?? record.links);
  const addresses = normalizeStringArray(record.addresses ?? record.address ?? record.locations ?? record.locationList);

  const normalized: Record<string, unknown> = {};

  if (vcard) {
    normalized.vcard = vcard;
  }
  if (name) {
    normalized.name = name;
  }
  if (lastName) {
    normalized.lastName = lastName;
  }
  if (organization) {
    normalized.organization = organization;
  }
  if (title) {
    normalized.title = title;
  }
  if (phones.length > 0) {
    normalized.phones = phones;
  }
  if (emails.length > 0) {
    normalized.emails = emails;
  }
  if (urls.length > 0) {
    normalized.urls = urls;
  }
  if (addresses.length > 0) {
    normalized.addresses = addresses;
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
};

export const normalizeContactsPayload = (input: unknown): Array<Record<string, unknown>> | null => {
  if (Array.isArray(input)) {
    const contacts = input
      .map((entry) => normalizeContactEntry(entry))
      .filter((entry): entry is Record<string, unknown> => Boolean(entry));
    return contacts.length > 0 ? contacts : null;
  }

  const single = normalizeContactEntry(input);
  return single ? [single] : null;
};

export const normalizeTemplatePayload = (
  input: unknown
): { name: string; namespace?: string; language?: string; components?: Array<Record<string, unknown>> } | null => {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const record = input as Record<string, unknown>;
  const name = normalizeString(record.name ?? record.template ?? record.templateName);
  if (!name) {
    return null;
  }

  const namespace = normalizeString(record.namespace ?? record.ns);
  const language = normalizeString(record.language ?? record.lang ?? record.locale);
  const components = Array.isArray(record.components)
    ? (record.components
        .map((component) =>
          component && typeof component === 'object'
            ? (component as Record<string, unknown>)
            : normalizeString(component)
            ? { text: normalizeString(component) }
            : null
        )
        .filter((component): component is Record<string, unknown> => Boolean(component)) as Array<
        Record<string, unknown>
      >)
    : null;

  const normalized: {
    name: string;
    namespace?: string;
    language?: string;
    components?: Array<Record<string, unknown>>;
  } = { name };

  if (namespace) {
    normalized.namespace = namespace;
  }
  if (language) {
    normalized.language = language;
  }
  if (components && components.length > 0) {
    normalized.components = components;
  }

  return normalized;
};

export const hasStructuredContactData = (input: unknown): boolean => {
  const contacts = normalizeContactsPayload(input);
  return Array.isArray(contacts) && contacts.length > 0;
};

export const hasValidLocationData = (input: unknown): boolean => {
  return normalizeLocationPayload(input) !== null;
};

export const hasValidTemplateData = (input: unknown): boolean => {
  return normalizeTemplatePayload(input) !== null;
};
