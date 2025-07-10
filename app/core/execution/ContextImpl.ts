import { RequestImpl } from '@core/execution/RequestImpl.ts';
import { ResponseImpl } from '@core/execution/ResponseImpl.ts';
import type { SetupImpl } from '@core/setup/SetupImpl.ts';
import type { InternalContextImpl } from '@typedefs/internal/InternalContextImpl.ts';
import type { InternalRequestImpl } from '@typedefs/internal/InternalRequestImpl.js';
import type { InternalResponseImpl } from '@typedefs/internal/InternalResponseImpl.js';
import type { Request } from '@typedefs/public/Request.ts';
import type { Response } from '@typedefs/public/Response.ts';

/**
 * ContextImpl is the core class that handles the building of the context.
 * It is responsible for building the request and response objects.
 */
export class ContextImpl implements InternalContextImpl {
  readonly _request: InternalRequestImpl;
  readonly _response: InternalResponseImpl;

  request: Request;
  response: Response;

  constructor(rawRequest: Buffer | string, setup: SetupImpl, clientAddress?: string) {
    this._request = new RequestImpl(rawRequest, setup, clientAddress);
    this._response = new ResponseImpl(this._request);

    this.request = this._request;
    this.response = this._response;
  }
}
