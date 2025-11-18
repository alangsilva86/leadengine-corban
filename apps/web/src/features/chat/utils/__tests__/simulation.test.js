import { describe, expect, it } from 'vitest';
import { parseMetadataText } from '../simulation.js';

describe('parseMetadataText', () => {
  it('returns null metadata without errors when text is empty', () => {
    expect(parseMetadataText('   ')).toEqual({ parsed: null, error: null });
  });

  it('flags invalid JSON inputs', () => {
    const result = parseMetadataText('invalid json');
    expect(result.parsed).toBeNull();
    expect(result.error).toBe('Metadata deve ser um JSON válido.');
  });

  it('flags non-object JSON inputs', () => {
    const result = parseMetadataText('"text"');
    expect(result.parsed).toBeNull();
    expect(result.error).toBe('Metadata deve ser um JSON válido.');
  });

  it('parses valid JSON objects', () => {
    const result = parseMetadataText('{"foo": "bar"}');
    expect(result).toEqual({ parsed: { foo: 'bar' }, error: null });
  });
});
