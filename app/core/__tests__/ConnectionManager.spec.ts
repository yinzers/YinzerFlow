/* eslint-disable max-classes-per-file */
import { EventEmitter } from 'events';
import type { Server, Socket } from 'net';
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { ConnectionManager } from '../ConnectionManager.ts';
import type { ConfigManager } from '../ConfigManager.ts';

// Mock ConfigManager class
class MockConfigManager {
  connectionOptions = {
    socketTimeout: 5000,
    keepAliveTimeout: 0,
    headersTimeout: 0,
    gracefulShutdownTimeout: 100,
  };
}

// Mock Socket class
class MockSocket extends EventEmitter {
  destroyed = false;
  ended = false;
  timeout = 0;
  keepAlive = false;
  keepAliveInitialDelay = 0;
  lastActivity = Date.now();

  setKeepAlive(enable: boolean, initialDelay?: number) {
    this.keepAlive = enable;
    if (initialDelay !== undefined) {
      this.keepAliveInitialDelay = initialDelay;
    }
    return this;
  }

  setTimeout(ms: number, callback?: () => void) {
    this.timeout = ms;
    if (callback) this.once('timeout', callback);
    return this;
  }

  destroy() {
    this.destroyed = true;
    this.emit('close');
    return this;
  }

  end() {
    this.ended = true;
    this.emit('end');
    return this;
  }

  write(data: string) {
    this.lastActivity = Date.now();
    return true;
  }

  // Simulate receiving data to update last activity
  emitData(data: Buffer) {
    this.lastActivity = Date.now();
    this.emit('data', data);
  }
}

// Mock Server class
class MockServer extends EventEmitter {
  closed = false;
  listening = false;

  listen() {
    this.listening = true;
    this.emit('listening');
    return this;
  }

  close(callback?: () => void) {
    this.closed = true;
    this.listening = false;
    if (callback) callback();
    return this;
  }
}

describe('ConnectionManager', () => {
  let connectionManager: ConnectionManager;
  let mockServer: MockServer;
  let mockSocket: MockSocket;
  let configManager: MockConfigManager;

  beforeEach(() => {
    configManager = new MockConfigManager();
    connectionManager = new ConnectionManager(configManager as unknown as ConfigManager);
    mockServer = new MockServer();
    mockSocket = new MockSocket();
  });

  afterEach(() => {
    // Clean up
    mockServer.removeAllListeners();
    mockSocket.removeAllListeners();
  });

  test('should initialize with default values', () => {
    expect(connectionManager.getConnectionCount()).toBe(0);
    expect(connectionManager.isListening()).toBe(false);
    expect(connectionManager.getServer()).toBeNull();
  });

  test('should set server and configure event listeners', () => {
    connectionManager.setServer(mockServer as unknown as Server);
    expect(connectionManager.getServer()).toBe(mockServer);
  });

  test('should set listening state', () => {
    connectionManager.setListening(true);
    expect(connectionManager.isListening()).toBe(true);

    connectionManager.setListening(false);
    expect(connectionManager.isListening()).toBe(false);
  });

  test('should add connection and set up event listeners', () => {
    const onSocketErrorSpy = spyOn(connectionManager, 'emit');

    connectionManager.addConnection(mockSocket as unknown as Socket);

    expect(connectionManager.getConnectionCount()).toBe(1);
    expect(mockSocket.timeout).toBeGreaterThan(0);

    // Simulate error event
    mockSocket.emit('error', new Error('Test error'));
    expect(onSocketErrorSpy).toHaveBeenCalled();

    // Simulate close event
    mockSocket.emit('close');
    expect(connectionManager.getConnectionCount()).toBe(0);
  });

  test('should get connection statistics', () => {
    // Set up initial state
    connectionManager.setServer(mockServer as unknown as Server);
    connectionManager.setListening(true);
    connectionManager.addConnection(mockSocket as unknown as Socket);

    // Simulate an error
    mockSocket.emit('error', new Error('Test error'));

    const stats = connectionManager.getStats();

    expect(stats.activeConnections).toBe(1);
    expect(stats.totalConnections).toBe(1);
    expect(stats.connectionErrors).toBe(1);
    expect(stats.uptime).toBeGreaterThanOrEqual(0);
  });

  test('should close all connections gracefully with grace period', async () => {
    const socket1 = new MockSocket();
    const socket2 = new MockSocket();

    connectionManager.addConnection(socket1 as unknown as Socket);
    connectionManager.addConnection(socket2 as unknown as Socket);

    const emitSpy = spyOn(connectionManager, 'emit');

    await connectionManager.closeAllConnections();

    expect(socket1.ended).toBe(true);
    expect(socket2.ended).toBe(true);
    expect(socket1.destroyed).toBe(true);
    expect(socket2.destroyed).toBe(true);
    expect(connectionManager.getConnectionCount()).toBe(0);
    expect(emitSpy).toHaveBeenCalled();
  });

  test('should close all connections immediately without grace period', async () => {
    const socket1 = new MockSocket();
    const socket2 = new MockSocket();

    // Set graceful shutdown timeout to 0 for immediate closure
    configManager.connectionOptions.gracefulShutdownTimeout = 0;

    connectionManager.addConnection(socket1 as unknown as Socket);
    connectionManager.addConnection(socket2 as unknown as Socket);

    await connectionManager.closeAllConnections();

    expect(socket1.ended).toBe(false); // Should not end gracefully
    expect(socket2.ended).toBe(false);
    expect(socket1.destroyed).toBe(true); // Should destroy immediately
    expect(socket2.destroyed).toBe(true);
    expect(connectionManager.getConnectionCount()).toBe(0);
  });

  test('should emit ALL_CONNECTIONS_CLOSED when no connections exist', async () => {
    const emitSpy = spyOn(connectionManager, 'emit');

    await connectionManager.closeAllConnections();

    expect(emitSpy).toHaveBeenCalled();
  });

  test('should handle socket timeout with HTTP response', () => {
    const timeoutSocket = new MockSocket();
    const emitSpy = spyOn(connectionManager, 'emit');
    let timeoutResponse = '';

    // Mock the end method to capture the response
    const originalEnd = timeoutSocket.end;
    timeoutSocket.end = function (data?: string) {
      if (data) timeoutResponse = data;
      return originalEnd.call(this);
    };

    connectionManager.addConnection(timeoutSocket as unknown as Socket);

    // Simulate timeout event
    timeoutSocket.emit('timeout');

    expect(timeoutSocket.ended).toBe(true);
    expect(timeoutSocket.destroyed).toBe(true);
    expect(timeoutResponse).toInclude('HTTP/1.1 408 Request Timeout');
    expect(emitSpy).toHaveBeenCalled();
  });

  test('should handle socket timeout without HTTP response when socket is already ended', () => {
    // TODO
  });

  test('should handle multiple requests on keep-alive connection', async () => {
    // TODO
  });

  test('should close keep-alive connection after timeout', async () => {
    // TODO
  });
});
