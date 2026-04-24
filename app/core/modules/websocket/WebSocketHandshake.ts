import { createHash } from 'crypto';
import { wsMagicGuid } from '@constants/websocket.ts';

interface HandshakeValid {
  valid: true;
  key: string;
  origin: string | undefined;
  path: string;
  query: Record<string, string>;
  protocols: Array<string>;
}

interface HandshakeInvalid {
  valid: false;
  reason: string;
}

type HandshakeResult = HandshakeInvalid | HandshakeValid;

/**
 * Check if raw HTTP headers contain a WebSocket upgrade request.
 * Case-insensitive match for both `Upgrade: websocket` and `Connection: Upgrade`.
 */
export const _isWebSocketUpgrade = (headersStr: string): boolean => {
  const lower = headersStr.toLowerCase();
  return lower.includes('upgrade: websocket') && lower.includes('connection:') && lower.includes('upgrade');
};

/**
 * Parse the request line to extract path and query parameters.
 */
const _parseRequestLine = (requestLine: string): { path: string; query: Record<string, string> } | null => {
  const requestMatch = /^GET\s+(?<path>\S+)\s+HTTP\/1\.1$/i.exec(requestLine);
  if (!requestMatch?.groups?.path) {
    return null;
  }

  const fullPath = requestMatch.groups.path;
  const queryIndex = fullPath.indexOf('?');
  const path = queryIndex >= 0 ? fullPath.substring(0, queryIndex) : fullPath;
  const query: Record<string, string> = {};

  if (queryIndex >= 0) {
    const queryStr = fullPath.substring(queryIndex + 1);
    for (const pair of queryStr.split('&')) {
      const eqIndex = pair.indexOf('=');
      if (eqIndex >= 0) {
        query[decodeURIComponent(pair.substring(0, eqIndex))] = decodeURIComponent(pair.substring(eqIndex + 1));
      } else {
        query[decodeURIComponent(pair)] = '';
      }
    }
  }

  return { path, query };
};

/**
 * Parse HTTP headers into a case-insensitive map.
 */
const _parseHeaders = (lines: Array<string>): Map<string, string> => {
  const headers = new Map<string, string>();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const colonIndex = line.indexOf(':');
    if (colonIndex < 0) continue;
    const [key = '', ...rest] = line.split(':');
    headers.set(key.trim().toLowerCase(), rest.join(':').trim());
  }
  return headers;
};

/**
 * Validate the Sec-WebSocket-Key header.
 */
const _validateSecWebSocketKey = (key: string): { valid: false; reason: string } | { valid: true } => {
  try {
    const decoded = Buffer.from(key, 'base64');
    if (decoded.length !== 16) {
      return { valid: false, reason: 'Sec-WebSocket-Key must decode to 16 bytes' };
    }
  } catch {
    return { valid: false, reason: 'Sec-WebSocket-Key is not valid base64' };
  }

  return { valid: true };
};

/**
 * Validate a WebSocket upgrade request per RFC 6455 §4.2.1.
 *
 * Checks:
 * - Sec-WebSocket-Key present and valid (base64, 16 bytes decoded)
 * - Sec-WebSocket-Version is 13
 * - Extracts origin, path, query string, and sub-protocol list
 */
export const _validateHandshake = (headersStr: string): HandshakeResult => {
  const lines = headersStr.split('\r\n');
  const [requestLine] = lines;
  if (!requestLine) {
    return { valid: false, reason: 'Empty request' };
  }

  // Parse request line: "GET /path?query HTTP/1.1"
  const pathQueryResult = _parseRequestLine(requestLine);
  if (!pathQueryResult) {
    return { valid: false, reason: 'Invalid request line — must be GET with HTTP/1.1' };
  }
  const { path, query } = pathQueryResult;

  // Parse headers into a map (case-insensitive keys)
  const headers = _parseHeaders(lines);

  // Sec-WebSocket-Key: required, base64-encoded 16 bytes
  const key = headers.get('sec-websocket-key');
  if (!key) {
    return { valid: false, reason: 'Missing Sec-WebSocket-Key header' };
  }
  const keyValidation = _validateSecWebSocketKey(key);
  if (!keyValidation.valid) {
    return keyValidation;
  }

  // Sec-WebSocket-Version: must be 13
  const version = headers.get('sec-websocket-version');
  if (version !== '13') {
    return { valid: false, reason: `Unsupported Sec-WebSocket-Version: ${version ?? 'missing'}` };
  }

  const origin = headers.get('origin');
  const protocolHeader = headers.get('sec-websocket-protocol');
  const protocols =
    protocolHeader ?
      protocolHeader
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
    : [];

  return { valid: true, key, origin, path, query, protocols };
};

/**
 * Generate the Sec-WebSocket-Accept value per RFC 6455 §4.2.2.
 * `SHA-1(clientKey + magicGUID)` → base64
 */
export const _generateAcceptKey = (clientKey: string): string =>
  createHash('sha1')
    .update(clientKey + wsMagicGuid)
    .digest('base64');

/**
 * Build the HTTP 101 Switching Protocols response string.
 */
export const _buildHandshakeResponse = (acceptKey: string, protocol?: string): string => {
  const lines = ['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${acceptKey}`];

  if (protocol) {
    lines.push(`Sec-WebSocket-Protocol: ${protocol}`);
  }

  return lines.join('\r\n').concat('\r\n\r\n');
};
