import { describe, expect, it } from 'bun:test';
import { _buildHandshakeResponse, _generateAcceptKey, _isWebSocketUpgrade, _validateHandshake } from '../WebSocketHandshake.ts';

const validUpgradeHeaders = [
  'GET /chat?room=lobby HTTP/1.1',
  'Host: server.example.com',
  'Upgrade: websocket',
  'Connection: Upgrade',
  'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
  'Sec-WebSocket-Version: 13',
  'Origin: http://example.com',
  'Sec-WebSocket-Protocol: chat, superchat',
].join('\r\n');

// ============================================
// _isWebSocketUpgrade
// ============================================

describe('_isWebSocketUpgrade', () => {
  it('should detect a valid WebSocket upgrade request', () => {
    expect(_isWebSocketUpgrade(validUpgradeHeaders)).toBe(true);
  });

  it('should be case-insensitive', () => {
    const headers = 'GET / HTTP/1.1\r\nUpGrAdE: WebSocket\r\nConnection: upgrade';
    expect(_isWebSocketUpgrade(headers)).toBe(true);
  });

  it('should return false when Upgrade header is missing', () => {
    const headers = 'GET / HTTP/1.1\r\nConnection: Upgrade\r\nSec-WebSocket-Key: abc';
    expect(_isWebSocketUpgrade(headers)).toBe(false);
  });

  it('should return false when Connection header is missing', () => {
    const headers = 'GET / HTTP/1.1\r\nUpgrade: websocket\r\nSec-WebSocket-Key: abc';
    expect(_isWebSocketUpgrade(headers)).toBe(false);
  });

  it('should return false for regular HTTP requests', () => {
    const headers = 'GET / HTTP/1.1\r\nHost: example.com\r\nAccept: text/html';
    expect(_isWebSocketUpgrade(headers)).toBe(false);
  });
});

// ============================================
// _validateHandshake
// ============================================

describe('_validateHandshake', () => {
  it('should validate a correct upgrade request', () => {
    const result = _validateHandshake(validUpgradeHeaders);
    expect(result.valid).toBe(true);
    if (!result.valid) return;

    expect(result.key).toBe('dGhlIHNhbXBsZSBub25jZQ==');
    expect(result.origin).toBe('http://example.com');
    expect(result.path).toBe('/chat');
    expect(result.query).toEqual({ room: 'lobby' });
    expect(result.protocols).toEqual(['chat', 'superchat']);
  });

  it('should fail when Sec-WebSocket-Key is missing', () => {
    const headers = ['GET / HTTP/1.1', 'Upgrade: websocket', 'Connection: Upgrade', 'Sec-WebSocket-Version: 13'].join('\r\n');

    const result = _validateHandshake(headers);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.reason).toContain('Sec-WebSocket-Key');
  });

  it('should fail when Sec-WebSocket-Key decodes to wrong length', () => {
    const headers = ['GET / HTTP/1.1', 'Upgrade: websocket', 'Connection: Upgrade', 'Sec-WebSocket-Key: dG9vc2hvcnQ=', 'Sec-WebSocket-Version: 13'].join(
      '\r\n',
    );

    const result = _validateHandshake(headers);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.reason).toContain('16 bytes');
  });

  it('should fail when Sec-WebSocket-Version is not 13', () => {
    const headers = [
      'GET / HTTP/1.1',
      'Upgrade: websocket',
      'Connection: Upgrade',
      'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
      'Sec-WebSocket-Version: 8',
    ].join('\r\n');

    const result = _validateHandshake(headers);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.reason).toContain('Version');
  });

  it('should fail when Sec-WebSocket-Version is missing', () => {
    const headers = ['GET / HTTP/1.1', 'Upgrade: websocket', 'Connection: Upgrade', 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ=='].join('\r\n');

    const result = _validateHandshake(headers);
    expect(result.valid).toBe(false);
  });

  it('should handle case-insensitive header names', () => {
    const headers = [
      'GET /test HTTP/1.1',
      'upgrade: websocket',
      'connection: Upgrade',
      'sec-websocket-key: dGhlIHNhbXBsZSBub25jZQ==',
      'sec-websocket-version: 13',
    ].join('\r\n');

    const result = _validateHandshake(headers);
    expect(result.valid).toBe(true);
  });

  it('should extract path without query string', () => {
    const headers = ['GET /simple-path HTTP/1.1', 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==', 'Sec-WebSocket-Version: 13'].join('\r\n');

    const result = _validateHandshake(headers);
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.path).toBe('/simple-path');
    expect(result.query).toEqual({});
  });

  it('should parse multiple query parameters', () => {
    const headers = ['GET /ws?user=alice&token=abc123&mode=fast HTTP/1.1', 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==', 'Sec-WebSocket-Version: 13'].join(
      '\r\n',
    );

    const result = _validateHandshake(headers);
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.path).toBe('/ws');
    expect(result.query).toEqual({ user: 'alice', token: 'abc123', mode: 'fast' });
  });

  it('should return empty protocols when header is absent', () => {
    const headers = ['GET / HTTP/1.1', 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==', 'Sec-WebSocket-Version: 13'].join('\r\n');

    const result = _validateHandshake(headers);
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.protocols).toEqual([]);
  });

  it('should return undefined origin when header is absent', () => {
    const headers = ['GET / HTTP/1.1', 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==', 'Sec-WebSocket-Version: 13'].join('\r\n');

    const result = _validateHandshake(headers);
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.origin).toBeUndefined();
  });

  it('should fail on empty input', () => {
    const result = _validateHandshake('');
    expect(result.valid).toBe(false);
  });

  it('should fail on non-GET request', () => {
    const headers = ['POST / HTTP/1.1', 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==', 'Sec-WebSocket-Version: 13'].join('\r\n');

    const result = _validateHandshake(headers);
    expect(result.valid).toBe(false);
  });
});

// ============================================
// _generateAcceptKey — RFC 6455 §4.2.2 test vector
// ============================================

describe('_generateAcceptKey', () => {
  it('should generate the correct accept key per RFC 6455 example', () => {
    const clientKey = 'dGhlIHNhbXBsZSBub25jZQ==';
    const expected = 's3pPLMBiTxaQ9kYGzzhZRbK+xOo=';

    expect(_generateAcceptKey(clientKey)).toBe(expected);
  });

  it('should produce different keys for different inputs', () => {
    const key1 = _generateAcceptKey('dGhlIHNhbXBsZSBub25jZQ==');
    const key2 = _generateAcceptKey('xqBt3ImNzJbYqRINxEFlkg==');
    expect(key1).not.toBe(key2);
  });
});

// ============================================
// _buildHandshakeResponse
// ============================================

describe('_buildHandshakeResponse', () => {
  it('should build a valid 101 response', () => {
    const response = _buildHandshakeResponse('s3pPLMBiTxaQ9kYGzzhZRbK+xOo=');
    expect(response).toContain('HTTP/1.1 101 Switching Protocols');
    expect(response).toContain('Upgrade: websocket');
    expect(response).toContain('Connection: Upgrade');
    expect(response).toContain('Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=');
    expect(response).toEndWith('\r\n\r\n');
  });

  it('should include protocol when specified', () => {
    const response = _buildHandshakeResponse('key123', 'chat');
    expect(response).toContain('Sec-WebSocket-Protocol: chat');
  });

  it('should not include protocol line when not specified', () => {
    const response = _buildHandshakeResponse('key123');
    expect(response).not.toContain('Sec-WebSocket-Protocol');
  });
});
