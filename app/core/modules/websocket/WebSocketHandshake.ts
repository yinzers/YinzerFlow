import { createHash } from 'crypto';
import { wsMagicGuid } from '@constants/websocket.ts';

interface HandshakeValid {
  valid: true;
  key: string;
  origin: string | undefined;
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
 * Validate a WebSocket upgrade request per RFC 6455 §4.2.1, on the method, protocol and headers the shared HTTP parser
 * produced (parseHttpRequest + parseRequestHeaders). The path and query come from the same parsed request, so hooks,
 * routing and the handshake all read one request line.
 *
 * Checks:
 * - Method is GET and protocol is HTTP/1.1
 * - Sec-WebSocket-Key present and valid (base64, 16 bytes decoded)
 * - Sec-WebSocket-Version is 13
 * - Extracts origin and sub-protocol list
 */
export const _validateHandshake = ({
  method,
  protocol,
  headers,
}: {
  method: string;
  protocol: string;
  headers: Partial<Record<string, string>>;
}): HandshakeResult => {
  if (method !== 'GET' || protocol !== 'HTTP/1.1') {
    return { valid: false, reason: 'Invalid request line — must be GET with HTTP/1.1' };
  }

  // Sec-WebSocket-Key: required, base64-encoded 16 bytes
  const key = headers['sec-websocket-key'];
  if (!key) {
    return { valid: false, reason: 'Missing Sec-WebSocket-Key header' };
  }
  const keyValidation = _validateSecWebSocketKey(key);
  if (!keyValidation.valid) {
    return keyValidation;
  }

  // Sec-WebSocket-Version: must be 13
  const version = headers['sec-websocket-version'];
  if (version !== '13') {
    return { valid: false, reason: `Unsupported Sec-WebSocket-Version: ${version ?? 'missing'}` };
  }

  const { origin } = headers;
  const protocolHeader = headers['sec-websocket-protocol'];
  const protocols =
    protocolHeader ?
      protocolHeader
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
    : [];

  return { valid: true, key, origin, protocols };
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
export const _buildHandshakeResponse = (acceptKey: string, protocol?: string, extensions?: string): string => {
  const lines = ['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${acceptKey}`];

  if (protocol) {
    lines.push(`Sec-WebSocket-Protocol: ${protocol}`);
  }

  if (extensions) {
    lines.push(`Sec-WebSocket-Extensions: ${extensions}`);
  }

  return lines.join('\r\n').concat('\r\n\r\n');
};
