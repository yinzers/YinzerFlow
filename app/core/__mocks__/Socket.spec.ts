import type { Socket } from 'net';

/**
 * A mock implementation of the Socket class for testing
 */
export class MockSocket {
  data = '';
  ended = false;

  write(data: string, callback?: () => void): boolean {
    this.data = data;
    if (callback) callback();
    return true;
  }

  end(): void {
    this.ended = true;
  }

  /**
   * Resets the mock socket state
   */
  reset(): void {
    this.data = '';
    this.ended = false;
  }

  /**
   * Returns the mock socket as a Socket type
   */
  asSocket(): Socket {
    return <Socket>(<unknown>this);
  }
}
