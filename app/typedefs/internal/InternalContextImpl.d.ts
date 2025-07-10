import type { Context } from '@typedefs/public/Context.js';
import type { InternalRequestImpl } from '@typedefs/internal/InternalRequestImpl.js';
import type { InternalResponseImpl } from '@typedefs/internal/InternalResponseImpl.js';

export interface InternalContextImpl extends Context {
  readonly _request: InternalRequestImpl;
  readonly _response: InternalResponseImpl;
}
