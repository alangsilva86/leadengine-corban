import { WhatsAppCryptoError } from './errors';

/**
 * Minimal, bounds-checked protobuf wire-format reader (only what the API needs to decode).
 * Wire types: 0 varint, 1 fixed64, 2 length-delimited, 3/4 start/end group (deprecated), 5 fixed32.
 */

const MAX_VARINT_BYTES = 10;
const MAX_GROUP_DEPTH = 32;

const malformed = (reason: string, offset: number): WhatsAppCryptoError =>
  new WhatsAppCryptoError('MALFORMED_PROTOBUF', `Malformed protobuf: ${reason}`, { details: { offset } });

export class ProtobufReader {
  private offset = 0;

  constructor(private readonly bytes: Uint8Array) {}

  get done(): boolean {
    return this.offset >= this.bytes.length;
  }

  get position(): number {
    return this.offset;
  }

  /** Reads an unsigned varint (up to 64 bits; values above 2^53 lose precision, which is fine for skipping). */
  varint(): number {
    let result = 0;
    let multiplier = 1;
    for (let index = 0; index < MAX_VARINT_BYTES; index += 1) {
      if (this.offset >= this.bytes.length) {
        throw malformed('truncated varint', this.offset);
      }
      const byte = this.bytes[this.offset]!;
      this.offset += 1;
      if (index === MAX_VARINT_BYTES - 1 && byte > 0x01) {
        throw malformed('varint overflows 64 bits', this.offset - 1);
      }
      result += (byte & 0x7f) * multiplier;
      if ((byte & 0x80) === 0) {
        return result;
      }
      multiplier *= 128;
    }
    throw malformed('varint too long', this.offset);
  }

  /** Reads a field tag and returns `{ fieldNumber, wireType }`. */
  tag(): { fieldNumber: number; wireType: number } {
    const start = this.offset;
    const value = this.varint();
    if (value > 0xffffffff) {
      throw malformed('tag out of range', start);
    }
    const fieldNumber = Math.floor(value / 8);
    const wireType = value % 8;
    if (fieldNumber === 0) {
      throw malformed('field number 0', start);
    }
    return { fieldNumber, wireType };
  }

  /** Reads a length-delimited payload (returned as a view on the input). */
  lengthDelimited(): Uint8Array {
    const start = this.offset;
    const length = this.varint();
    if (length > this.bytes.length - this.offset) {
      throw malformed('length exceeds buffer', start);
    }
    const value = this.bytes.subarray(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  private advance(count: number): void {
    if (count > this.bytes.length - this.offset) {
      throw malformed('truncated fixed-width field', this.offset);
    }
    this.offset += count;
  }

  /** Skips the value of a field with the given wire type (including nested groups). */
  skip(wireType: number, fieldNumber: number, depth = 0): void {
    switch (wireType) {
      case 0:
        this.varint();
        return;
      case 1:
        this.advance(8);
        return;
      case 2:
        this.lengthDelimited();
        return;
      case 5:
        this.advance(4);
        return;
      case 3: {
        if (depth >= MAX_GROUP_DEPTH) {
          throw malformed('groups nested too deeply', this.offset);
        }
        for (;;) {
          if (this.done) {
            throw malformed('unterminated group', this.offset);
          }
          const inner = this.tag();
          if (inner.wireType === 4) {
            if (inner.fieldNumber !== fieldNumber) {
              throw malformed('mismatched end group', this.offset);
            }
            return;
          }
          this.skip(inner.wireType, inner.fieldNumber, depth + 1);
        }
      }
      case 4:
        throw malformed('unexpected end group', this.offset);
      default:
        throw malformed(`invalid wire type ${wireType}`, this.offset);
    }
  }
}
