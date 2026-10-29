/* eslint-disable no-bitwise */
import { constants, deflateRawSync, inflateRawSync } from 'node:zlib';

const DEFLATE_TAIL = Buffer.from([0x00, 0x00, 0xff, 0xff]);

/**
 * Compress a payload using raw DEFLATE with Z_SYNC_FLUSH, then strip the
 * trailing sync marker (0x00 0x00 0xFF 0xFF) per RFC 7692 §7.2.1.
 *
 * Uses deflateRawSync — no persistent zlib state, which is correct for
 * no-context-takeover mode. zlib-ng in Bun provides SIMD acceleration.
 */
export const _compressPayload = (payload: Buffer, level: number, windowBits: number): Buffer => {
  const compressed = deflateRawSync(payload, {
    level,
    windowBits,
    finishFlush: constants.Z_SYNC_FLUSH,
  });

  if (compressed.length >= 4 && compressed.subarray(-4).equals(DEFLATE_TAIL)) {
    return compressed.subarray(0, -4);
  }
  return compressed;
};

/**
 * Decompress a permessage-deflate payload: append the sync marker, then inflate.
 * Per RFC 7692 §7.2.3, the sender stripped the trailing bytes.
 *
 * `maxOutputLength` caps the inflated size, so a small compressed frame can't expand into an unbounded buffer
 * (a decompression bomb). Past it, zlib throws an error with code `ERR_BUFFER_TOO_LARGE`.
 */
export const _decompressPayload = (payload: Buffer, windowBits: number, maxOutputLength?: number): Buffer =>
  inflateRawSync(Buffer.concat([payload, DEFLATE_TAIL]), {
    windowBits,
    finishFlush: constants.Z_SYNC_FLUSH,
    ...(maxOutputLength === undefined ? {} : { maxOutputLength }),
  });

/**
 * Parse the client's Sec-WebSocket-Extensions header value for permessage-deflate offers.
 * Returns the first valid permessage-deflate offer's parameters, or null if none found.
 */
export const _parseCompressionOffer = (
  headerValue: string,
): {
  serverNoContextTakeover: boolean;
  clientNoContextTakeover: boolean;
  serverMaxWindowBits: number | undefined;
  clientMaxWindowBitsOffered: boolean;
  clientMaxWindowBits: number | undefined;
} | null => {
  const offers = headerValue.split(',').map((s) => s.trim());

  for (const offer of offers) {
    const parts = offer.split(';').map((s) => s.trim());
    if (parts[0] !== 'permessage-deflate') continue;

    let serverNoContextTakeover = false;
    let clientNoContextTakeover = false;
    let serverMaxWindowBits: number | undefined = undefined;
    let clientMaxWindowBitsOffered = false;
    let clientMaxWindowBits: number | undefined = undefined;

    for (let i = 1; i < parts.length; i++) {
      const param = parts[i];
      if (!param) continue;
      const [key, value] = param.split('=').map((s) => s.trim());

      if (key === 'server_no_context_takeover') {
        serverNoContextTakeover = true;
      } else if (key === 'client_no_context_takeover') {
        clientNoContextTakeover = true;
      } else if (key === 'server_max_window_bits') {
        const bits = value ? parseInt(value, 10) : undefined;
        if (bits !== undefined && (bits < 9 || bits > 15)) return null;
        serverMaxWindowBits = bits;
      } else if (key === 'client_max_window_bits') {
        clientMaxWindowBitsOffered = true;
        const bits = value ? parseInt(value, 10) : undefined;
        if (bits !== undefined && (bits < 9 || bits > 15)) return null;
        clientMaxWindowBits = bits;
      }
    }

    return { serverNoContextTakeover, clientNoContextTakeover, serverMaxWindowBits, clientMaxWindowBitsOffered, clientMaxWindowBits };
  }

  return null;
};

/**
 * The LZ77 window the server compresses with on a connection: the configured window, or the client's
 * server_max_window_bits when that is smaller (RFC 7692 §7.1.2.1). The response header and every frame the server
 * compresses for the connection (send and broadcast alike) must use this one value.
 */
export const _negotiatedServerWindowBits = (
  clientOffer: NonNullable<ReturnType<typeof _parseCompressionOffer>>,
  configuredServerMaxWindowBits: number,
): number => Math.min(configuredServerMaxWindowBits, clientOffer.serverMaxWindowBits ?? configuredServerMaxWindowBits);

/**
 * The window the server inflates client messages with. A 15-bit (32 KB) window decodes a stream compressed with any
 * smaller one, and the server can't always limit the client: RFC 7692 §7.1.2.2 forbids client_max_window_bits in the
 * response unless the client offered it, so such a client may use 15. The configured clientMaxWindowBits is only what
 * the server asks of a client that offered the parameter.
 */
export const _inflateWindowBits = 15;

/**
 * Build the server's Sec-WebSocket-Extensions response header value.
 * Always forces no-context-takeover (both directions) for broadcast compatibility.
 */
export const _buildCompressionResponse = (
  clientOffer: NonNullable<ReturnType<typeof _parseCompressionOffer>>,
  serverConfig: { serverMaxWindowBits: number; clientMaxWindowBits: number },
): string => {
  const parts = ['permessage-deflate'];

  // Always require no-context-takeover (both directions) for encode-once broadcast
  parts.push('server_no_context_takeover');
  parts.push('client_no_context_takeover');

  const serverBits = _negotiatedServerWindowBits(clientOffer, serverConfig.serverMaxWindowBits);

  if (serverBits < 15) {
    parts.push(`server_max_window_bits=${serverBits}`);
  }

  // Client max window bits — only if client offered the parameter
  if (clientOffer.clientMaxWindowBitsOffered) {
    const clientBits =
      clientOffer.clientMaxWindowBits === undefined ?
        serverConfig.clientMaxWindowBits
      : Math.min(serverConfig.clientMaxWindowBits, clientOffer.clientMaxWindowBits);

    if (clientBits < 15) {
      parts.push(`client_max_window_bits=${clientBits}`);
    }
  }

  return parts.join('; ');
};
