export declare const POLL_PLACEHOLDER_MESSAGES: Set<string>;
export declare const normalizeTextValue: (value: unknown) => string | null;
export declare const getFirstNonEmptyString: (...candidates: unknown[]) => string | null;
export declare const getFirstInteger: (...candidates: unknown[]) => number | null;
export declare const dedupeNormalizedStrings: (values: Iterable<unknown>) => string[];
export declare const isPollPlaceholderText: (value: unknown) => boolean;
