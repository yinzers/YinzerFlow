/* eslint-disable max-classes-per-file */
import { EventEmitter } from 'events';
import type { Server, Socket } from 'net';
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { ConnectionManager } from '../ConnectionManager.ts';

// Mock Socket class
class MockSocket extends EventEmitter {
  destroyed = false;
  ended = false;
  timeout = 0;

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

  beforeEach(() => {
    connectionManager = new ConnectionManager();
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

    // Use a small grace period for testing
    await connectionManager.closeAllConnections(100);

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
});
