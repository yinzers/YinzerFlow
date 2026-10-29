/**
 * Bytes received on a WebSocket and not yet parsed, kept as the chunks they arrived in. Chunks are joined only when a
 * caller needs a contiguous prefix (a frame header, then a whole frame), so a large frame streamed in many TCP chunks
 * is copied once when it completes instead of on every chunk.
 */
export class WebSocketReceiveBuffer {
  private readonly _chunks: Array<Buffer> = [];
  private _length = 0;

  /** Total bytes held. */
  get length(): number {
    return this._length;
  }

  push(chunk: Buffer): void {
    this._chunks.push(chunk);
    this._length += chunk.length;
  }

  /** The first `length` bytes as one buffer (it may be longer), joining leading chunks only when the first is shorter. */
  first(length: number): Buffer {
    const [head] = this._chunks;
    if (head && head.length >= length) return head;

    let joinedLength = 0;
    let count = 0;
    for (const chunk of this._chunks) {
      if (joinedLength >= length) break;
      joinedLength += chunk.length;
      count++;
    }
    const joined = Buffer.concat(this._chunks.slice(0, count), joinedLength);
    this._chunks.splice(0, count, joined);
    return joined;
  }

  /** Drop `length` bytes from the front. */
  consume(length: number): void {
    let remaining = length;
    let [head] = this._chunks;
    while (remaining > 0 && head) {
      if (head.length <= remaining) {
        remaining -= head.length;
        this._chunks.shift();
        [head] = this._chunks;
      } else {
        this._chunks[0] = head.subarray(remaining);
        remaining = 0;
      }
    }
    this._length -= length;
  }
}
