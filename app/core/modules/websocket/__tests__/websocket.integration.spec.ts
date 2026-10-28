/* eslint-disable
  no-bitwise,
  @typescript-eslint/no-non-null-assertion
*/
import net from 'net';
import { createHash } from 'crypto';
import { afterEach, describe, expect, it, mock } from 'bun:test';
import { _encodeFrame } from '../WebSocketFrame.ts';
import { buildClientFrame } from './ws-test-utils.ts';
import { YinzerFlow } from '@core/YinzerFlow.ts';
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
const buildUpgradeRequest = (path: string, key = 'dGhlIHNhbXBsZSBub25jZQ==', origin?: string): string => {
  let req = `GET ${path} HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n`;
  if (origin) req += `Origin: ${origin}\r\n`;
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
): Promise<{
  socket: net.Socket;
  response: string;
}> =>
  new Promise((resolve, reject) => {
    const socket = net.createConnection({ port: testPort, host: '127.0.0.1' }, () => {
      socket.write(buildUpgradeRequest(path, key, origin));
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
