import 'express';
import 'http';

declare module 'http' {
  interface IncomingMessage {
    rawBody?: Buffer;
    rawBodyParseError?: SyntaxError | null;
  }
}

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
      rawBodyParseError?: SyntaxError | null;
    }
  }
}

export {};
