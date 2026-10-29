/* eslint-disable
  no-bitwise,
  @typescript-eslint/no-non-null-assertion
*/
import net from 'net';
import { createHash } from 'crypto';
import { afterEach, describe, expect, it, mock } from 'bun:test';
import { _encodeFrame } from '../WebSocketFrame.ts';
import { _compressPayload } from '../WebSocketCompression.ts';
import { buildClientFrame } from './ws-test-utils.ts';
import { YinzerFlow } from '@core/YinzerFlow.ts';
import { rejectUpgrade } from '@core/modules/websocket/WebSocketUpgradeRejection.ts';
import { wsCloseCode, wsMagicGuid, wsOpcode } from '@constants/websocket.ts';

let _nextTestPort = 14000;

const createTestApp = (customConfig?: Record<string, unknown>): { app: YinzerFlow; testPort: number } => {
  const testPort = _nextTestPort++;
  return {
    app: new YinzerFlow({ port: testPort, host: '127.0.0.1', ...customConfig }),
    testPort,
  };
};

/**
 * Build a WebSocket upgrade request string.
 */
const buildUpgradeRequest = (path: string, key = 'dGhlIHNhbXBsZSBub25jZQ==', origin?: string, extraHeaders = '', host = 'localhost'): string => {
  let req = `GET ${path} HTTP/1.1\r\nHost: ${host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n`;
  if (origin) req += `Origin: ${origin}\r\n`;
  req += extraHeaders;
  req += '\r\n';
  return req;
};

/**
 * Connect a raw TCP socket, send upgrade, wait for 101 or error response.
 */
const connectWs = async (
  testPort: number,
  path = '/ws',
  key = 'dGhlIHNhbXBsZSBub25jZQ==',
  origin?: string,
  extraHeaders = '',
  host = 'localhost',
): Promise<{
  socket: net.Socket;
  response: string;
}> =>
  new Promise((resolve, reject) => {
    const socket = net.createConnection({ port: testPort, host: '127.0.0.1' }, () => {
      socket.write(buildUpgradeRequest(path, key, origin, extraHeaders, host));
    });
    let data = '';
    const onData = (chunk: Buffer): void => {
      data += chunk.toString();
      if (data.includes('\r\n\r\n')) {
        socket.removeListener('data', onData);
        resolve({ socket, response: data });
      }
    };
    socket.on('data', onData);
    socket.on('error', reject);
    setTimeout(() => reject(new Error('Connection timeout')), 2000);
  });

/**
 * Read the next WebSocket frame from a socket.
 */
const readFrame = async (socket: net.Socket): Promise<{ opcode: number; payload: Buffer }> =>
  new Promise((resolve, reject) => {
    const onData = (chunk: Buffer): void => {
      socket.removeListener('data', onData);
      const byte0 = chunk[0]!;
      const byte1 = chunk[1]!;
      const opcode = byte0 & 0x0f;
      let payloadLength = byte1 & 0x7f;
      let offset = 2;
      if (payloadLength === 126) {
        payloadLength = chunk.readUInt16BE(2);
        offset = 4;
      }
      resolve({ opcode, payload: chunk.subarray(offset, offset + payloadLength) });
    };
    socket.on('data', onData);
    setTimeout(() => reject(new Error('Read timeout')), 2000);
  });

/** Resolve once `condition` holds, or reject after `timeoutMs`; polls instead of sleeping a fixed time. */
const waitFor = async (condition: () => boolean, timeoutMs = 2000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('waitFor timed out');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

describe('WebSocket Integration', () => {
  let app: YinzerFlow;

  afterEach(async () => {
    if (app.status().isListening) {
      await app.close();
    }
  });

  // Bug: the upgrade used its own CRLF-only, last-wins header parser, so a second proxy's X-Forwarded-For line erased the
  // client and the upgrade resolved to the proxy, unlike the same request over HTTP. Tier: High (client identity).
  describe('client address on upgrade', () => {
    it('should resolve remoteAddress with the HTTP header parser and the trusted-proxy walk', async () => {
      const { testPort } = createTestApp();
      app = new YinzerFlow({ port: testPort, host: '127.0.0.1', gracefulShutdownTimeout: 0, ipSecurity: { trustedProxies: ['127.0.0.1', '10.0.0.0/8'] } });
      let remoteAddress = '';
      app.ws('/ws', {
        upgrade(request) {
          ({ remoteAddress } = request);
          return {};
        },
        message() {},
      });
      await app.listen();

      const response = await new Promise<string>((resolve, reject) => {
        const socket = net.createConnection({ port: testPort, host: '127.0.0.1' }, () => {
          socket.write(buildUpgradeRequest('/ws').replace('\r\n\r\n', '\r\nX-Forwarded-For: 198.51.100.7\r\nX-Forwarded-For: 10.0.0.5\r\n\r\n'));
        });
        socket.once('data', (chunk) => {
          resolve(chunk.toString());
          socket.destroy();
        });
        socket.on('error', reject);
      });

      expect(response).toContain('101 Switching Protocols');
      expect(remoteAddress).toBe('198.51.100.7');
    });
  });

  describe('core connection lifecycle', () => {
    it('should complete WebSocket handshake and exchange messages', async () => {
      const messageFn = mock((_data: Buffer | string) => {});
      const { testPort } = createTestApp();
      app = new YinzerFlow({ port: testPort, host: '127.0.0.1', gracefulShutdownTimeout: 0 });
      app.ws('/ws', {
        message(ws, data) {
          messageFn(data);
          ws.send(`echo:${String(data)}`);
        },
      });
      await app.listen();

      const { socket, response } = await connectWs(testPort);
      expect(response).toContain('101 Switching Protocols');

      const expectedAccept = createHash('sha1').update(`dGhlIHNhbXBsZSBub25jZQ==${wsMagicGuid}`).digest('base64');
      expect(response).toContain(`Sec-WebSocket-Accept: ${expectedAccept}`);

      // Send a text message
      const readPromise = readFrame(socket);
      socket.write(buildClientFrame(wsOpcode.text, Buffer.from('hello')));
      const frame = await readPromise;

      expect(frame.opcode).toBe(wsOpcode.text);
      expect(frame.payload.toString()).toBe('echo:hello');
      expect(messageFn).toHaveBeenCalledTimes(1);

      socket.destroy();
    });

    it('should handle binary messages', async () => {
      const { testPort } = createTestApp();
      app = new YinzerFlow({ port: testPort, host: '127.0.0.1', gracefulShutdownTimeout: 0 });
      app.ws('/ws', {
        message(ws, _data, isBinary) {
          ws.send(isBinary ? Buffer.from('binary-ok') : Buffer.from('text'));
        },
      });
      await app.listen();

      const { socket } = await connectWs(testPort);
      const readPromise = readFrame(socket);
      socket.write(buildClientFrame(wsOpcode.binary, Buffer.from([0xde, 0xad])));
      const frame = await readPromise;

      expect(frame.opcode).toBe(wsOpcode.binary);
      expect(frame.payload.toString()).toBe('binary-ok');
      socket.destroy();
    });

    it('should pass per-socket data from upgrade handler', async () => {
      const { testPort } = createTestApp();
      app = new YinzerFlow({ port: testPort, host: '127.0.0.1', gracefulShutdownTimeout: 0 });
      app.ws<{ userId: string }>('/ws', {
        upgrade() {
          return { userId: 'user-42' };
        },
        message(ws) {
          ws.send(ws.data.userId);
        },
      });
      await app.listen();

      const { socket } = await connectWs(testPort);
      const readPromise = readFrame(socket);
      socket.write(buildClientFrame(wsOpcode.text, Buffer.from('who')));
      const frame = await readPromise;

      expect(frame.payload.toString()).toBe('user-42');
      socket.destroy();
    });
  });

  // Bug (0.9.0): with no wsBeforeMessage hook a throwing message handler escaped the read loop before the receive buffer
  // advanced, so the failing frame was parsed again on every later read and the client's later messages never arrived.
  // Tier: Medium (user flow: one bad message must not wedge a connection).
  describe('throwing message handler', () => {
    it.each([
      ['without', false],
      ['with', true],
    ])('should consume the failing frame and deliver later messages (%s a wsBeforeMessage hook)', async (_label, withHook) => {
      const { testPort } = createTestApp();
      app = new YinzerFlow({ port: testPort, host: '127.0.0.1', gracefulShutdownTimeout: 0, logging: { level: 'off' } });
      if (withHook) app.wsBeforeMessage([() => {}]);
      const seen: Array<string> = [];
      app.ws('/ws', {
        message(_ws, data) {
          seen.push(String(data));
          if (String(data) === '1') throw new Error('handler blew up on 1');
        },
      });
      await app.listen();

      const { socket } = await connectWs(testPort);
      for (const text of ['1', '2', '3']) {
        socket.write(buildClientFrame(wsOpcode.text, Buffer.from(text)));
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      await waitFor(() => seen.length >= 3).catch(() => {});

      expect(seen).toEqual(['1', '2', '3']);
      socket.destroy();
    });
  });

  // Bug (0.9.0): a wsBeforeMessage hook could only stop a message by throwing, which logged an error. Returning false
  // must drop the message (no handler, no after hooks) without an error. Tier: Medium (hook short-circuit contract).
  describe('wsBeforeMessage short-circuit', () => {
    it('should drop a message when a before hook returns false, and still deliver the next one', async () => {
      const { testPort } = createTestApp();
      app = new YinzerFlow({ port: testPort, host: '127.0.0.1', gracefulShutdownTimeout: 0 });
      const seen: Array<string> = [];
      const afterSeen: Array<string> = [];
      app.wsBeforeMessage([(_ws, data) => (String(data) === 'drop' ? false : undefined)]);
      app.wsAfterMessage([(_ws, data) => void afterSeen.push(String(data))]);
      app.ws('/ws', {
        message(_ws, data) {
          seen.push(String(data));
        },
      });
      await app.listen();

      const { socket } = await connectWs(testPort);
      socket.write(buildClientFrame(wsOpcode.text, Buffer.from('drop')));
      socket.write(buildClientFrame(wsOpcode.text, Buffer.from('keep')));
      await waitFor(() => seen.length >= 1);
      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(seen).toEqual(['keep']);
      expect(afterSeen).toEqual(['keep']);
      socket.destroy();
    });
  });

  // Bug (0.9.0, security): upgrades skipped every global hook, so a ws route with no upgrade handler answered 101 while
  // the same app's REST routes answered 401: auth failed open. Tier: High (authz on a whole transport).
  describe('global hooks on upgrade', () => {
    const authHook = (ctx: { request: { headers: Record<string, string | undefined> }; response: { setStatusCode: (code: 401) => void } }): unknown => {
      if (ctx.request.headers.authorization === 'Bearer good') return undefined;
      ctx.response.setStatusCode(401);
      return { error: 'Unauthorized' };
    };
    const authHeader = (token: string): string => `Authorization: Bearer ${token}\r\n`;

    it('should refuse an upgrade with the 401 a beforeAll auth hook returns for REST, and pass a valid token', async () => {
      const { testPort } = createTestApp();
      app = new YinzerFlow({ port: testPort, host: '127.0.0.1', gracefulShutdownTimeout: 0 });
      app.beforeAll([authHook as never]);
      app.get('/api/me', () => ({ ok: true }));
      app.ws('/ws', {
        message(ws, data) {
          ws.send(data);
        },
      });
      await app.listen();

      const rest = await fetch(`http://127.0.0.1:${testPort}/api/me`);
      expect(rest.status).toBe(401);

      const refused = await connectWs(testPort, '/ws', undefined, undefined, authHeader('bad'));
      await waitFor(() => refused.socket.readableEnded || refused.socket.destroyed).catch(() => {});
      expect(refused.response).toStartWith('HTTP/1.1 401');
      expect(refused.response).toContain('Unauthorized');
      expect(refused.response).not.toContain('101 Switching Protocols');

      const accepted = await connectWs(testPort, '/ws', undefined, undefined, authHeader('good'));
      expect(accepted.response).toContain('101 Switching Protocols');
      refused.socket.destroy();
      accepted.socket.destroy();
    });

    it('should skip a hook whose routesToExclude matches the ws path, by its canonical form', async () => {
      const { testPort } = createTestApp();
      app = new YinzerFlow({ port: testPort, host: '127.0.0.1', gracefulShutdownTimeout: 0 });
      app.beforeAll([authHook as never], { routesToExclude: ['/ws/*'] });
      app.ws('/ws/public', { message() {} });
      app.ws('/private', { message() {} });
      await app.listen();

      // '//ws/public/' canonicalizes to '/ws/public', so the exclusion applies exactly as it would for HTTP
      const excluded = await connectWs(testPort, '//ws/public/');
      expect(excluded.response).toContain('101 Switching Protocols');
      const guarded = await connectWs(testPort, '/private');
      expect(guarded.response).toStartWith('HTTP/1.1 401');
      excluded.socket.destroy();
      guarded.socket.destroy();
    });

    // Bug (0.10.0 review): state the global hooks set on an upgrade (an auth hook's user) never reached the ws route, so
    // apps had to re-verify the token in upgrade(). Tier: Medium (hook-to-upgrade handoff contract).
    it('should hand the hooks ctx.state to upgrade() as req.state, so it can carry it into ws.data', async () => {
      const { testPort } = createTestApp();
      app = new YinzerFlow({ port: testPort, host: '127.0.0.1', gracefulShutdownTimeout: 0 });
      app.beforeAll([
        (ctx) => {
          ctx.state.userId = 'user-7';
        },
      ]);
      app.ws<{ userId: string }>('/ws', {
        upgrade(req) {
          return { userId: String(req.state.userId) };
        },
        message(ws) {
          ws.send(ws.data.userId);
        },
      });
      await app.listen();

      const { socket } = await connectWs(testPort);
      const readPromise = readFrame(socket);
      socket.write(buildClientFrame(wsOpcode.text, Buffer.from('who am i')));
      const frame = await readPromise;

      expect(frame.payload.toString()).toBe('user-7');
      socket.destroy();
    });

    // Bug (0.10.0 review, blocker): a client that disconnected while an async hook was awaiting still got the 101 written,
    // trackConnect and open(), but its close event had already fired, so the per-IP slot was never released. Dropped
    // clients filled the cap and every later client got 429 until restart. Tier: High (per-IP cap is DoS protection).
    it('should not leak a per-IP slot when the client disconnects during an async hook', async () => {
      const { testPort } = createTestApp();
      app = new YinzerFlow({ port: testPort, host: '127.0.0.1', gracefulShutdownTimeout: 0, websocket: { maxConnectionsPerIp: 1 } });
      app.beforeAll([async () => new Promise((resolve) => setTimeout(resolve, 300))]);
      app.ws('/ws', { message() {} });
      await app.listen();

      // Two clients send the upgrade and vanish while the hook is still awaiting
      for (const key of ['AAAAAAAAAAAAAAAAAAAAAA==', 'BBBBBBBBBBBBBBBBBBBBBB==']) {
        const dropped = net.createConnection({ port: testPort, host: '127.0.0.1' }, () => {
          dropped.write(buildUpgradeRequest('/ws', key));
          setTimeout(() => dropped.destroy(), 50);
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 500));

      // The one slot is still free, and still the only one
      const first = await connectWs(testPort, '/ws', 'CCCCCCCCCCCCCCCCCCCCCC==');
      const second = await connectWs(testPort, '/ws', 'DDDDDDDDDDDDDDDDDDDDDD==');
      expect(first.response).toContain('101 Switching Protocols');
      expect(second.response).toStartWith('HTTP/1.1 429');
      first.socket.destroy();
      second.socket.destroy();
    }, 10_000);

    // Bug (0.10.0 review): a hook returning null, false or 0 answers like any returned value, but with the status still
    // 200, so the upgrade was refused with "200 OK": a client reads that as neither success nor refusal.
    // Tier: Medium (refusal status contract; each row is a falsy value a hook might return).
    it.each([
      ['null', null],
      ['false', false],
      ['0', 0],
    ])('should refuse with 403 when a hook answers with %s and no status', async (_label, returned) => {
      const { testPort } = createTestApp();
      app = new YinzerFlow({ port: testPort, host: '127.0.0.1', gracefulShutdownTimeout: 0 });
      app.beforeAll([() => returned]);
      app.ws('/ws', { message() {} });
      await app.listen();

      const { socket, response } = await connectWs(testPort);
      expect(response).toStartWith('HTTP/1.1 403');
      socket.destroy();
    });

    it('should answer 429 from the global rate limiter on an upgrade flood', async () => {
      const { testPort } = createTestApp();
      app = new YinzerFlow({ port: testPort, host: '127.0.0.1', gracefulShutdownTimeout: 0, rateLimit: { max: 2, window: '1m' } });
      app.ws('/ws', { message() {} });
      await app.listen();

      const first = await connectWs(testPort, '/ws', 'AAAAAAAAAAAAAAAAAAAAAA==');
      const second = await connectWs(testPort, '/ws', 'BBBBBBBBBBBBBBBBBBBBBB==');
      const third = await connectWs(testPort, '/ws', 'CCCCCCCCCCCCCCCCCCCCCC==');

      expect(first.response).toContain('101 Switching Protocols');
      expect(second.response).toContain('101 Switching Protocols');
      expect(third.response).toStartWith('HTTP/1.1 429');
      for (const client of [first, second, third]) client.socket.destroy();
    });
  });

  // Bug (0.9.0): a throw in the upgrade handler (or, since 0.10.0, in a global hook on the upgrade) dropped the socket with
  // no HTTP response, and a malformed upgrade header was logged at ERROR with a stack and the raw client bytes.
  // Tier: Medium (error states a client handles differently: 500 vs 400).
  describe('upgrade errors', () => {
    it.each([
      ['the upgrade handler', 'handler'],
      ['a beforeAll hook', 'hook'],
    ])('should answer 500 through onError when %s throws', async (_label, thrower) => {
      const { testPort } = createTestApp();
      app = new YinzerFlow({ port: testPort, host: '127.0.0.1', gracefulShutdownTimeout: 0, logging: { level: 'off' } });
      if (thrower === 'hook') {
        app.beforeAll([
          () => {
            throw new Error('hook blew up');
          },
        ]);
      }
      app.ws('/ws', {
        upgrade() {
          if (thrower === 'handler') throw new Error('upgrade blew up');
          return {};
        },
      });
      await app.listen();

      const { socket, response } = await connectWs(testPort);
      expect(response).toStartWith('HTTP/1.1 500');
      expect(response).toContain('Internal Server Error');
      socket.destroy();
    });

    it('should answer 400 to a malformed upgrade header and log the name at debug, sanitized, never at error', async () => {
      const logged: { debug: Array<string>; error: Array<string> } = { debug: [], error: [] };
      const sink =
        (level: 'debug' | 'error') =>
        (...args: Array<unknown>) =>
          void logged[level].push(args.map(String).join(' '));
      const { testPort } = createTestApp();
      app = new YinzerFlow({
        port: testPort,
        host: '127.0.0.1',
        gracefulShutdownTimeout: 0,
        logging: { level: 'debug', logger: { info: () => {}, warn: () => {}, error: sink('error'), debug: sink('debug') } },
      });
      app.ws('/ws', { message() {} });
      await app.listen();

      const { socket, response } = await connectWs(testPort, '/ws', undefined, undefined, 'X-\u001b[31mEvil Name: 1\r\n');
      expect(response).toStartWith('HTTP/1.1 400');
      expect(logged.error).toEqual([]);
      expect(logged.debug.some((line) => line.includes('Invalid header name: X-[31mEvil Name'))).toBe(true);
      expect(logged.debug.some((line) => line.includes('\u001b'))).toBe(false);
      socket.destroy();
    });
  });

  describe('upgrade rejection', () => {
    it('should return 403 when upgrade handler returns false', async () => {
      const { testPort } = createTestApp();
      app = new YinzerFlow({ port: testPort, host: '127.0.0.1', gracefulShutdownTimeout: 0 });
      app.ws('/ws', {
        upgrade() {
          return false;
        },
      });
      await app.listen();

      const { response } = await connectWs(testPort);
      expect(response).toContain('403');
      expect(response).toContain('rejected');
    });

    // Bug (0.9.x): the upgrade handler could only refuse with 403 (`false`), so an expired token couldn't answer 401
    // and a client couldn't tell "log in again" from "forbidden". Tier: Medium (error state a client handles differently).
    // Bug (0.10.x): a code missing from the status table (418, 503) threw while refusing and answered 500.
    it.each([
      [401, 'HTTP/1.1 401 Unauthorized'],
      [418, "HTTP/1.1 418 I'm a teapot"],
      [503, 'HTTP/1.1 503 Service Unavailable'],
    ])('should answer rejectUpgrade(%d) with that status and body', async (statusCode, statusLine) => {
      const { testPort } = createTestApp();
      app = new YinzerFlow({ port: testPort, host: '127.0.0.1', gracefulShutdownTimeout: 0 });
      app.ws('/ws', {
        upgrade() {
          return rejectUpgrade(statusCode, { error: 'Token expired' });
        },
      });
      await app.listen();

      const { socket, response } = await connectWs(testPort);
      expect(response).toStartWith(statusLine);
      expect(response).toContain('{"error":"Token expired"}');
      socket.destroy();
    });

    // Bug (0.10.x): an unset or empty allowedOrigins allowed every origin, so any site could open a cookie-authenticated
    // socket (cross-site WebSocket hijacking) unless the app opted in. 0.11.0: unset means same-origin, ['*'] is the only
    // allow-all and [] refuses every browser origin. Bug (0.9.x): with a list, a missing Origin got 403 and locked out
    // every non-browser client; a missing Origin follows allowMissingOrigin in every mode.
    // Tier: High (origin check is the CSWSH defence; each row is one boundary of it).
    const sameOrigin = undefined;
    it.each([
      ['same origin is allowed by default', sameOrigin, {}, 'localhost', 'http://localhost', '101 Switching Protocols'],
      ['same origin matches case-insensitively', sameOrigin, {}, 'App.Example:8080', 'http://app.example:8080', '101 Switching Protocols'],
      ['a cross origin is refused by default', sameOrigin, {}, 'localhost', 'https://evil.example', 'HTTP/1.1 403'],
      ['a port mismatch is refused by default', sameOrigin, {}, 'localhost:3000', 'http://localhost:4000', 'HTTP/1.1 403'],
      ['an explicit default port in Host matches', sameOrigin, {}, 'app.example:443', 'https://app.example', '101 Switching Protocols'],
      ['an explicit :80 in Origin matches a bare Host', sameOrigin, {}, 'app.example', 'http://app.example:80', '101 Switching Protocols'],
      ["the other scheme's default port is refused", sameOrigin, {}, 'app.example:443', 'http://app.example', 'HTTP/1.1 403'],
      ['a non-web scheme is refused by default', sameOrigin, {}, 'localhost', 'capacitor://localhost', 'HTTP/1.1 403'],
      ['an opaque "null" Origin is refused by default', sameOrigin, {}, 'localhost', 'null', 'HTTP/1.1 403'],
      ["['*'] allows a cross origin", ['*'], {}, 'localhost', 'https://evil.example', '101 Switching Protocols'],
      ['[] refuses a same-origin browser request', [], {}, 'localhost', 'http://localhost', 'HTTP/1.1 403'],
      ['a listed origin is allowed', ['https://App.Example'], {}, 'localhost', 'https://app.example', '101 Switching Protocols'],
      ['an unlisted origin is refused', ['https://app.example'], {}, 'app.example', 'https://evil.example', 'HTTP/1.1 403'],
      ['a list does not imply same origin', ['https://app.example'], {}, 'localhost', 'http://localhost', 'HTTP/1.1 403'],
      ['default: a missing Origin is allowed', sameOrigin, {}, 'localhost', undefined, '101 Switching Protocols'],
      [
        'default: a missing Origin is refused with allowMissingOrigin: false',
        sameOrigin,
        { allowMissingOrigin: false },
        'localhost',
        undefined,
        'HTTP/1.1 403',
      ],
      ["['*']: a missing Origin is allowed", ['*'], {}, 'localhost', undefined, '101 Switching Protocols'],
      ["['*']: a missing Origin is refused with allowMissingOrigin: false", ['*'], { allowMissingOrigin: false }, 'localhost', undefined, 'HTTP/1.1 403'],
      ['[]: a missing Origin is allowed', [], {}, 'localhost', undefined, '101 Switching Protocols'],
      ['[]: a missing Origin is refused with allowMissingOrigin: false', [], { allowMissingOrigin: false }, 'localhost', undefined, 'HTTP/1.1 403'],
      ['list: a missing Origin is allowed', ['https://app.example'], {}, 'localhost', undefined, '101 Switching Protocols'],
      [
        'list: a missing Origin is refused with allowMissingOrigin: false',
        ['https://app.example'],
        { allowMissingOrigin: false },
        'localhost',
        undefined,
        'HTTP/1.1 403',
      ],
    ] as const)('origin policy: %s', async (_label, allowedOrigins, extra, host, origin, expected) => {
      const { testPort } = createTestApp();
      app = new YinzerFlow({
        port: testPort,
        host: '127.0.0.1',
        gracefulShutdownTimeout: 0,
        websocket: { ...(allowedOrigins === undefined ? {} : { allowedOrigins: [...allowedOrigins] }), ...extra },
      });
      app.ws('/ws', { message() {} });
      await app.listen();

      const { socket, response } = await connectWs(testPort, '/ws', undefined, origin, '', host);
      expect(response).toContain(expected);
      socket.destroy();
    });

    // Bug (0.10.x): any string was accepted, so a typo ('https://app.example/', a bare host, '*.example') silently never
    // matched, and '*' next to real origins was ambiguous. Tier: High (validator for the CSWSH defence).
    it.each([
      ["'*' mixed with an origin", ['*', 'https://app.example'], "'*' must be the only entry"],
      ['a bare host', ['app.example'], 'is not an origin'],
      ['a trailing slash', ['https://app.example/'], 'is not an origin'],
      ['a path', ['https://app.example/chat'], 'is not an origin'],
      ['a wildcard subdomain', ['https://*.example.com'], 'is not an origin'],
      ['the opaque origin "null"', ['null'], 'is not an origin'],
      ['an explicit default port', ['https://app.example:443'], 'browsers omit the default port'],
      ['a port out of range', ['http://app.example:65536'], 'port must be 1-65535'],
      ['a non-string entry', [42], 'is not an origin'],
    ])('should refuse allowedOrigins with %s at config time', (_label, allowedOrigins, message) => {
      expect(() => new YinzerFlow({ websocket: { allowedOrigins: allowedOrigins as Array<string> } })).toThrow(message);
    });

    it.each([[['*']], [[]], [['https://app.example', 'http://localhost:3000', 'capacitor://localhost', 'http://[::1]:8080']]])(
      'should accept allowedOrigins %j',
      (allowedOrigins) => {
        expect(() => new YinzerFlow({ websocket: { allowedOrigins } })).not.toThrow();
      },
    );

    // Probed for 0.11.0: afterAll runs only on refused upgrades. An accepted upgrade has no HTTP response to change, and
    // the 101 is written on its own. Catches routing the accept path through the shared refusal/response writer, where
    // an afterAll that sets a status, headers or a body would rewrite or follow the 101 and break the handshake.
    // Tier: Medium (handshake contract every client depends on).
    it('should send a clean 101 and skip afterAll on an accepted upgrade', async () => {
      const { testPort } = createTestApp();
      app = new YinzerFlow({ port: testPort, host: '127.0.0.1', gracefulShutdownTimeout: 0 });
      let afterAllRuns = 0;
      app.afterAll([
        (ctx) => {
          afterAllRuns++;
          ctx.response.setStatusCode(500);
          ctx.response.addHeaders({ 'X-After-All': '1' });
          return { hijacked: true };
        },
      ]);
      app.ws('/ws', {
        message(ws, data) {
          ws.send(data);
        },
      });
      await app.listen();

      const { socket, response } = await connectWs(testPort);
      const clean101 = ['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', 'Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo='];
      expect(response).toBe(`${clean101.join('\r\n')}\r\n\r\n`);
      const echo = readFrame(socket);
      socket.write(buildClientFrame(wsOpcode.text, Buffer.from('still a websocket')));
      expect((await echo).payload.toString()).toBe('still a websocket');
      expect(afterAllRuns).toBe(0);
      socket.destroy();
    });

    // Bug (0.10.0 review): the upgrade re-parsed the request line on \s+ while hooks saw the HTTP parser's split on ' ',
    // so `GET\t/ws` gave hooks the path "HTTP/1.1" while the ws router matched /ws. Tier: High (hook path must equal route path).
    it('should answer 400 to an upgrade whose request line is not single-space separated', async () => {
      const { testPort } = createTestApp();
      app = new YinzerFlow({ port: testPort, host: '127.0.0.1', gracefulShutdownTimeout: 0 });
      app.ws('/ws', { message() {} });
      await app.listen();

      const response = await new Promise<string>((resolve, reject) => {
        const socket = net.createConnection({ port: testPort, host: '127.0.0.1' }, () => {
          socket.write(buildUpgradeRequest('/ws').replace('GET /ws', 'GET\t/ws'));
        });
        socket.once('data', (chunk) => {
          resolve(chunk.toString());
          socket.destroy();
        });
        socket.on('error', reject);
      });

      expect(response).toStartWith('HTTP/1.1 400');
    });

    // Bug (0.10.0 review): origin 403, the per-IP cap's 429 and upgrade() === false were written by a bare string
    // writer, so they skipped default headers, afterAll and the access log, and the cap answered "429 Error".
    // Tier: Medium (one refusal contract for every upgrade refusal).
    it.each([
      ['a wrong Origin', 'origin', 'HTTP/1.1 403 Forbidden'],
      ['upgrade() returning false', 'false', 'HTTP/1.1 403 Forbidden'],
      ['the per-IP cap', 'cap', 'HTTP/1.1 429 Too Many Requests'],
    ])('should answer %s through the normal response path', async (_label, refusal, statusLine) => {
      const { testPort } = createTestApp();
      app = new YinzerFlow({
        port: testPort,
        host: '127.0.0.1',
        gracefulShutdownTimeout: 0,
        websocket: { allowedOrigins: ['https://app.example'], maxConnectionsPerIp: 1 },
      });
      app.afterAll([(ctx) => void ctx.response.addHeaders({ 'X-Request-Id': 'abc123' })]);
      let upgradeCalls = 0;
      app.ws('/ws', {
        upgrade: () => {
          upgradeCalls++;
          return refusal === 'false' ? false : {};
        },
      });
      await app.listen();

      const held = refusal === 'cap' ? await connectWs(testPort, '/ws', 'AAAAAAAAAAAAAAAAAAAAAA==') : undefined;
      const callsBeforeRefusal = upgradeCalls;
      const origin = refusal === 'origin' ? 'https://evil.example' : undefined;
      const { socket, response } = await connectWs(testPort, '/ws', undefined, origin);

      expect(response).toStartWith(statusLine);
      expect(response).toContain('X-Request-Id: abc123');
      expect(response).toContain('X-Content-Type-Options: nosniff');
      // Security pass (0.10.0): an IP already at its cap ran every global hook and upgrade() before its 429, so a held
      // cap didn't stop an upgrade flood from reaching app code. The pre-check refuses before any of it runs.
      if (refusal === 'cap') expect(upgradeCalls - callsBeforeRefusal).toBe(0);
      socket.destroy();
      held?.socket.destroy();
    });

    it('should return 404 for non-existent WS route', async () => {
      const { testPort } = createTestApp();
      app = new YinzerFlow({ port: testPort, host: '127.0.0.1', gracefulShutdownTimeout: 0 });
      app.ws('/ws', { message() {} });
      await app.listen();

      const { response } = await connectWs(testPort, '/nonexistent');
      expect(response).toContain('404');
    });

    it('should return 400 for malformed handshake (bad version)', async () => {
      const { testPort } = createTestApp();
      app = new YinzerFlow({ port: testPort, host: '127.0.0.1', gracefulShutdownTimeout: 0 });
      app.ws('/ws', { message() {} });
      await app.listen();

      const badRequest =
        'GET /ws HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
        'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 8\r\n\r\n';

      const { response } = await new Promise<{ socket: net.Socket; response: string }>((resolve, reject) => {
        const socket = net.createConnection({ port: testPort, host: '127.0.0.1' }, () => {
          socket.write(badRequest);
        });
        let data = '';
        socket.on('data', (chunk: Buffer) => {
          data += chunk.toString();
          if (data.includes('\r\n\r\n')) resolve({ socket, response: data });
        });
        socket.on('error', reject);
        setTimeout(() => reject(new Error('Timeout')), 2000);
      });

      expect(response).toContain('400');
    });
  });

  describe('HTTP regression', () => {
    it('should handle normal HTTP requests when WS routes are registered', async () => {
      const { testPort } = createTestApp();
      app = new YinzerFlow({ port: testPort, host: '127.0.0.1', gracefulShutdownTimeout: 0 });
      app.ws('/ws', { message() {} });
      app.get('/api/test', () => ({ ok: true }));
      await app.listen();

      const response = await fetch(`http://127.0.0.1:${testPort}/api/test`);
      expect(response.status).toBe(200);
      const body = (await response.json()) as { ok: boolean };
      expect(body.ok).toBe(true);
    });
  });

  describe('parameterized routes', () => {
    it('should match parameterized WS routes and pass params', async () => {
      const { testPort } = createTestApp();
      app = new YinzerFlow({ port: testPort, host: '127.0.0.1', gracefulShutdownTimeout: 0 });
      app.ws<{ room: string }>('/chat/:room', {
        upgrade(req) {
          const { room } = req.params;
          if (!room) return false;
          return { room };
        },
        message(ws) {
          ws.send(ws.data.room);
        },
      });
      await app.listen();

      const { socket } = await connectWs(testPort, '/chat/lobby');
      const readPromise = readFrame(socket);
      socket.write(buildClientFrame(wsOpcode.text, Buffer.from('which room?')));
      const frame = await readPromise;

      expect(frame.payload.toString()).toBe('lobby');
      socket.destroy();
    });
  });

  describe('pub/sub', () => {
    it('should broadcast messages to channel subscribers', async () => {
      const { testPort } = createTestApp();
      app = new YinzerFlow({ port: testPort, host: '127.0.0.1', gracefulShutdownTimeout: 0 });
      app.ws('/ws', {
        open(ws) {
          ws.subscribe('updates');
        },
        message(ws, data) {
          ws.publish('updates', data as string);
        },
      });
      await app.listen();

      // Connect two clients
      const client1 = await connectWs(testPort, '/ws', 'AAAAAAAAAAAAAAAAAAAAAA==');
      const client2 = await connectWs(testPort, '/ws', 'BBBBBBBBBBBBBBBBBBBBBB==');

      // Client1 sends, client2 should receive (client1 is excluded as sender)
      const readPromise = readFrame(client2.socket);
      client1.socket.write(buildClientFrame(wsOpcode.text, Buffer.from('broadcast')));

      const frame = await readPromise;
      expect(frame.payload.toString()).toBe('broadcast');

      client1.socket.destroy();
      client2.socket.destroy();
    });

    it('should support app.publish() from outside WS context', async () => {
      const { testPort } = createTestApp();
      app = new YinzerFlow({ port: testPort, host: '127.0.0.1', gracefulShutdownTimeout: 0 });
      app.ws('/ws', {
        open(ws) {
          ws.subscribe('server-events');
        },
      });
      app.get('/trigger', () => {
        app.publish('server-events', JSON.stringify({ type: 'quote', price: 42.5 }));
        return { sent: true };
      });
      await app.listen();

      const { socket } = await connectWs(testPort);
      // Wait a tick for open handler to run
      await new Promise((resolve) => setTimeout(resolve, 50));

      const readPromise = readFrame(socket);
      await fetch(`http://127.0.0.1:${testPort}/trigger`);

      const frame = await readPromise;
      const parsed = JSON.parse(frame.payload.toString());
      expect(parsed.type).toBe('quote');
      expect(parsed.price).toBe(42.5);

      socket.destroy();
    });
    // Bug (0.10.x): subscribe() added the connection whatever its state, and the channel is only cleaned when the socket
    // closes. An async open() that subscribed after the client had gone (or a close() handler that subscribed) left the
    // dead connection in the channel forever: subscriberCount kept counting it and the connection was never freed.
    // Tier: Medium (resource leak on a core flow; one row per way to reach a non-open subscribe).
    it.each([
      ['an async open() that subscribes after the client has gone', 'late-open'],
      ['a close() handler that subscribes', 'in-close'],
    ])('should not subscribe a closed connection: %s', async (_label, mode) => {
      const { testPort } = createTestApp();
      app = new YinzerFlow({ port: testPort, host: '127.0.0.1', gracefulShutdownTimeout: 0 });
      let markClosed: () => void = () => {};
      const closed = new Promise<void>((resolve) => {
        markClosed = resolve;
      });
      let subscribeResult = undefined as boolean | undefined;
      const subscribed = new Promise<void>((resolve, reject) => {
        app.ws('/ws', {
          open(ws) {
            if (mode !== 'late-open') return;
            closed
              .then(() => {
                subscribeResult = ws.subscribe('room');
                resolve();
              })
              .catch(reject);
          },
          close(ws) {
            markClosed();
            if (mode !== 'in-close') return;
            subscribeResult = ws.subscribe('room');
            resolve();
          },
        });
      });
      await app.listen();

      const { socket } = await connectWs(testPort);
      socket.destroy();
      await subscribed;

      expect(app.subscriberCount('room')).toBe(0);
      expect(app.publish('room', 'hello')).toBe(0);
      expect(subscribeResult).toBe(false);
    });
  });

  // Bug (0.10.x, found by running the `ws` reference client): the negotiated window sizes went into the response header
  // and nowhere else. A client that asked for server_max_window_bits=9 got "9" in the header and frames compressed with
  // the configured 11, which it can't inflate ("invalid distance too far back"); with compression.clientMaxWindowBits
  // below 15 and a client that offered no client_max_window_bits (so it may use 15), the server inflated with the
  // smaller window and closed 1007. Tier: Medium (feature flow; each row is a negotiation outcome a client sees).
  describe('permessage-deflate window negotiation', () => {
    // Matches only at distance 1000, so a 512-byte window (9 bits) can't use them and 9 and 11 compress differently
    const farRepeats = (blocks: number): string => {
      let seed = 42;
      let block = '';
      for (let i = 0; i < 1000; i++) {
        seed = (seed * 16_807) % 2_147_483_647; // Park-Miller: exact in a double
        block += String.fromCharCode(33 + (seed % 90));
      }
      return block.repeat(blocks);
    };
    const text = farRepeats(3);
    const compressedClientFrame = (payload: string, windowBits: number): Buffer => {
      const frame = buildClientFrame(wsOpcode.text, _compressPayload(Buffer.from(payload), 1, windowBits));
      frame[0] = frame[0]! | 0x40; // RSV1
      return frame;
    };
    const startCompressedApp = async (compression: Record<string, unknown>): Promise<number> => {
      const { testPort } = createTestApp();
      app = new YinzerFlow({
        port: testPort,
        host: '127.0.0.1',
        gracefulShutdownTimeout: 0,
        websocket: { compression: { enabled: true, threshold: 0, ...compression } },
      });
      app.ws('/ws', {
        open(ws) {
          ws.subscribe('all');
        },
        message(ws, data) {
          if (data === 'broadcast') app.publish('all', text);
          else ws.send(data);
        },
      });
      await app.listen();
      return testPort;
    };

    it.each([
      ['no window offer: the configured window', 'permessage-deflate', 11],
      ['an offer of 9: the smaller window', 'permessage-deflate; server_max_window_bits=9', 9],
      ['an offer above the configured window: the configured window', 'permessage-deflate; server_max_window_bits=15', 11],
    ])('should compress with the window it agreed to, %s', async (_label, offer, windowBits) => {
      const testPort = await startCompressedApp({});
      const { socket, response } = await connectWs(testPort, '/ws', undefined, undefined, `Sec-WebSocket-Extensions: ${offer}\r\n`);
      expect(response).toContain(`server_max_window_bits=${windowBits}`);

      const echo = readFrame(socket);
      socket.write(buildClientFrame(wsOpcode.text, Buffer.from(text)));
      expect((await echo).payload.equals(_compressPayload(Buffer.from(text), 1, windowBits))).toBe(true);
      socket.destroy();
    });

    it('should broadcast to each subscriber with the window that subscriber agreed to', async () => {
      // The rows above and below only discriminate if the two windows really give different bytes
      expect(_compressPayload(Buffer.from(text), 1, 9).equals(_compressPayload(Buffer.from(text), 1, 11))).toBe(false);
      const testPort = await startCompressedApp({});
      const small = await connectWs(
        testPort,
        '/ws',
        'AAAAAAAAAAAAAAAAAAAAAA==',
        undefined,
        'Sec-WebSocket-Extensions: permessage-deflate; server_max_window_bits=9\r\n',
      );
      const normal = await connectWs(testPort, '/ws', 'BBBBBBBBBBBBBBBBBBBBBB==', undefined, 'Sec-WebSocket-Extensions: permessage-deflate\r\n');
      const third = await connectWs(testPort, '/ws', 'CCCCCCCCCCCCCCCCCCCCCC==');
      await waitFor(() => app.subscriberCount('all') === 3);

      const smallFrame = readFrame(small.socket);
      const normalFrame = readFrame(normal.socket);
      third.socket.write(buildClientFrame(wsOpcode.text, Buffer.from('broadcast')));

      expect((await smallFrame).payload.equals(_compressPayload(Buffer.from(text), 1, 9))).toBe(true);
      expect((await normalFrame).payload.equals(_compressPayload(Buffer.from(text), 1, 11))).toBe(true);
      for (const client of [small, normal, third]) client.socket.destroy();
    });

    it('should inflate a window-15 message from a client it could not limit, whatever clientMaxWindowBits is', async () => {
      const testPort = await startCompressedApp({ clientMaxWindowBits: 9 });
      const received: Array<string> = [];
      app.ws('/inflate', { message: (_ws, data) => void received.push(String(data)) });
      const long = farRepeats(200); // past zlib's 16 KB output chunk, where a too-small window fails
      const { socket, response } = await connectWs(testPort, '/inflate', undefined, undefined, 'Sec-WebSocket-Extensions: permessage-deflate\r\n');
      expect(response).not.toContain('client_max_window_bits');

      socket.write(compressedClientFrame(long, 15));
      await waitFor(() => received.length === 1 || socket.destroyed);
      expect(received[0] === long).toBe(true);
      socket.destroy();
    });
  });

  // Claim investigated for 0.10.0: "the idle timer only resets on client frames and the server never pings, so a
  // listen-only browser drops after 120 s". Heartbeat is on by default (30 s < 120 s idle) and a pong is a client frame,
  // so it resets the idle timer. These pin that with short timings; the control proves the idle timer does fire.
  // Tier: Medium (a listen-only client is a core flow: dashboards, tickers).
  describe('listen-only client and the idle timeout', () => {
    /** Connect a client that never sends data, only answers pings with pongs as every browser does. */
    const connectListenOnly = async (testPort: number, answerPings: boolean): Promise<{ socket: net.Socket; closed: () => boolean }> => {
      const { socket } = await connectWs(testPort);
      let closed = false;
      socket.on('data', (chunk: Buffer) => {
        const opcode = chunk[0]! & 0x0f;
        if (opcode === wsOpcode.ping && answerPings) socket.write(buildClientFrame(wsOpcode.pong, Buffer.alloc(0)));
        if (opcode === wsOpcode.close) closed = true;
      });
      socket.on('close', () => {
        closed = true;
      });
      return { socket, closed: () => closed };
    };

    it('should keep a listen-only client that answers pings open past several idle timeouts', async () => {
      const { testPort } = createTestApp();
      app = new YinzerFlow({ port: testPort, host: '127.0.0.1', gracefulShutdownTimeout: 0, websocket: { idleTimeout: 1.5, heartbeat: { interval: 1 } } });
      app.ws('/ws', { message() {} });
      await app.listen();

      const client = await connectListenOnly(testPort, true);
      await new Promise((resolve) => setTimeout(resolve, 3500));

      expect(client.closed()).toBe(false);
      client.socket.destroy();
    }, 15_000);

    it('should close a silent client at the idle timeout when no heartbeat runs (control)', async () => {
      const { testPort } = createTestApp();
      app = new YinzerFlow({
        port: testPort,
        host: '127.0.0.1',
        gracefulShutdownTimeout: 0,
        logging: { level: 'off' },
        websocket: { idleTimeout: 1.5, heartbeat: { enabled: false } },
      });
      app.ws('/ws', { message() {} });
      await app.listen();

      const client = await connectListenOnly(testPort, true);
      await waitFor(client.closed, 4000);

      expect(client.closed()).toBe(true);
      client.socket.destroy();
    }, 15_000);
  });

  describe('graceful shutdown', () => {
    it('should send close frame to all WS connections on server close', async () => {
      const { testPort } = createTestApp();
      app = new YinzerFlow({ port: testPort, host: '127.0.0.1', gracefulShutdownTimeout: 0 });
      app.ws('/ws', { message() {} });
      await app.listen();

      const { socket } = await connectWs(testPort);

      // Start reading BEFORE close — close sends frame then blocks on server.close()
      const framePromise = readFrame(socket);
      app.close().catch(() => {});
      const frame = await framePromise;

      expect(frame.opcode).toBe(wsOpcode.close);
      const code = frame.payload.readUInt16BE(0);
      expect(code).toBe(wsCloseCode.goingAway);

      socket.destroy();
    });
  });
});
