import type { InternalHttpEncoding, InternalHttpHeaders, InternalHttpStatus, InternalHttpStatusCode } from '@typedefs/constants/http.js';
import type { Request } from '@typedefs/public/Request.js';
import type { Response } from '@typedefs/public/Response.js';

export interface InternalResponseImpl extends Response {
  readonly _request: Request;
  _statusCode: InternalHttpStatusCode;
  _status: InternalHttpStatus;
  _headers: Partial<Record<InternalHttpHeaders, string>>;
  _body: unknown;
  _stringBody: string;
  _encoding: InternalHttpEncoding;
  _setHeadersIfNotSet: (headers: Partial<Record<InternalHttpHeaders, string>>) => void;
  _parseResponseIntoString: () => void;
  _setBody: (body: unknown) => void;
}
