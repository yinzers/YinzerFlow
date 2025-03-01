import type { Enum } from '../Common.ts';
import type { HttpStatus, HttpStatusCode } from '../../constants/http.ts';
import type { THttpMethod } from './Request.ts';

export type THttpStatus = Enum<typeof HttpStatus>;
export type THttpStatusCode = Enum<typeof HttpStatusCode>;

export interface IHeaders {
  /* eslint-disable @typescript-eslint/naming-convention */
  Authorization?: string;
  Proxy_Authorization?: string;
  'WWW-Authenticate'?: string;
  Age?: string;
  'Cache-Control'?: string;
  'Clear-Site-Data'?: string;
  Expires?: string;
  'No-Vary-Search'?: string;
  'Last-Modified'?: string;
  ETag?: string;
  'If-Match'?: string;
  'If-None-Match'?: string;
  'If-Modified-Since'?: string;
  'If-Unmodified-Since'?: string;
  Vary?: string;
  Connection?: string;
  'Keep-Alive'?: string;
  Accept?: string;
  'Accept-Encoding'?: string;
  'Accept-Language'?: string;
  Expect?: string;
  'Max-Forwards'?: string;
  Cookie?: string;
  'Set-Cookie'?: string;
  'Access-Control-Allow-Credentials'?: string;
  'Access-Control-Allow-Methods'?: string;
  'Access-Control-Allow-Headers'?: string;
  'Access-Control-Allow-Origin'?: string;
  'Access-Control-Expose-Headers'?: string;
  'Access-Control-Max-Age'?: string;
  'Access-Control-Request-Headers'?: string;
  'Access-Control-Request-Method'?: string;
  Origin?: string;
  'Timing-Allow-Origin'?: string;
  'Content-Disposition'?: string;
  'Content-Length'?: string;
  'Content-Type'?: string | 'application/json' | 'text/html' | 'text/plain';
  'Content-Encoding'?: string;
  'Content-Language'?: string;
  'Content-Location'?: string;
  Forwarded?: string;
  Via?: string;
  Location?: string;
  Refresh?: string;
  From?: string;
  Host?: string;
  Referer?: string;
  'Referrer-Policy'?: string;
  'User-Agent'?: string;
  Allow?: string;
  Server?: string;
  Range?: string;
  'Accept-Ranges'?: string;
  'Content-Range'?: string;
  'If-Range'?: string;
  'Cross-Origin-Embedder-Policy'?: string;
  'Cross-Origin-Opener-Policy'?: string;
  'Cross-Origin-Resource-Policy'?: string;
  'Content-Security-Policy'?: string;
  'Content-Security-Policy-Report-Only'?: string;
  'Permissions-Policy'?: string;
  'Strict-Transport-Security'?: string;
  'Upgrade-Insecure-Requests'?: string;
  'X-Content-Type-Options'?: string;
  'X-Frames-Options'?: string;
  'X-Permitted-Cross-Domain-Policies'?: string;
  'X-Powered-By'?: string;
  'X-XSS-Protection'?: string;
  'Report-To'?: string;
  TE?: string;
  Trailer?: string;
  'Transfer-Encoding'?: string;
  'Alt-Svc'?: string;
  'Alt-Used'?: string;
  Date?: string;
  Link?: string;
  'Retry-After'?: string;
  'Server-Timing'?: string;
  'Service-Worker-Allowed'?: string;
  SourceMap?: string;
  Upgrade?: string;
  Priority?: string;
  'Sec-GPC'?: string;
  /* eslint-enable @typescript-eslint/naming-convention */
}

export type TResponseBody<T> = T;

export interface IResponse {
  status: THttpStatus;
  statusCode: THttpStatusCode;
  protocol: string;
  method: THttpMethod;
  path: string;
  headers: IHeaders;
  body: TResponseBody<unknown>;
}
