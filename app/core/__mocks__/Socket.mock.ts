import { Socket } from 'net';

/**
 * A mock implementation of the Socket class for testing
 */
export class MockSocket {
  public data: string = '';
  public ended: boolean = false;

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
    return this as unknown as Socket;
  }
}
