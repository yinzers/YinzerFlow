import type { Enum } from '../Common.ts';
import type { ContentType, HttpStatus, HttpStatusCode } from '../../constants/http.ts';
import type { THttpMethod } from './Request.ts';

/**
 * Represents an HTTP status text
 * 
 * This type is derived from the HttpStatus enum constants and ensures
 * that only valid HTTP status texts can be used throughout the application.
 */
export type THttpStatus = Enum<typeof HttpStatus>;

/**
 * Represents an HTTP status code
 * 
 * This type is derived from the HttpStatusCode enum constants and ensures
 * that only valid HTTP status codes can be used throughout the application.
 */
export type THttpStatusCode = Enum<typeof HttpStatusCode>;

/**
 * Represents HTTP headers
 * 
 * This interface defines all standard HTTP headers as optional properties.
 * The property names match the exact header names as they appear in HTTP requests and responses.
 */
export interface IHeaders {
  /* eslint-disable @typescript-eslint/naming-convention */
  /** Authorization credentials for HTTP authentication */
  Authorization?: string;
  /** Authorization credentials for HTTP authentication through a proxy */
  Proxy_Authorization?: string;
  /** Authentication method that should be used to gain access to a resource */
  'WWW-Authenticate'?: string;
  /** Time in seconds the object has been in a proxy cache */
  Age?: string;
  /** Directives for caching mechanisms in both requests and responses */
  'Cache-Control'?: string;
  /** Clear browsing data (cookies, storage, etc.) */
  'Clear-Site-Data'?: string;
  /** Date/time after which the response is considered stale */
  Expires?: string;
  /** Indicates that search parameters should not be included in the cache key */
  'No-Vary-Search'?: string;
  /** Date and time at which the origin server believes the resource was last modified */
  'Last-Modified'?: string;
  /** Identifier for a specific version of a resource */
  ETag?: string;
  /** Makes the request conditional based on the ETag value */
  'If-Match'?: string;
  /** Makes the request conditional based on the ETag value */
  'If-None-Match'?: string;
  /** Makes the request conditional based on the modification date */
  'If-Modified-Since'?: string;
  /** Makes the request conditional based on the modification date */
  'If-Unmodified-Since'?: string;
  /** Indicates how the content varies based on request headers */
  Vary?: string;
  /** Controls whether the network connection stays open after the current transaction finishes */
  Connection?: string;
  /** Parameters for the keep-alive connection */
  'Keep-Alive'?: string;
  /** Media types that are acceptable for the response */
  Accept?: string;
  /** Acceptable encodings for the response */
  'Accept-Encoding'?: string;
  /** Acceptable languages for the response */
  'Accept-Language'?: string;
  /** Indicates server requirements from the client */
  Expect?: string;
  /** Limit the number of times the message can be forwarded through proxies or gateways */
  'Max-Forwards'?: string;
  /** Contains stored HTTP cookies */
  Cookie?: string;
  /** Send cookies from the server to the user-agent */
  'Set-Cookie'?: string;
  /** Indicates whether the response can be shared when credentials are provided */
  'Access-Control-Allow-Credentials'?: string;
  /** Methods allowed when accessing the resource in CORS */
  'Access-Control-Allow-Methods'?: string;
  /** Headers allowed when accessing the resource in CORS */
  'Access-Control-Allow-Headers'?: string;
  /** Origins allowed to access the resource in CORS */
  'Access-Control-Allow-Origin'?: string;
  /** Headers that can be exposed as part of the response in CORS */
  'Access-Control-Expose-Headers'?: string;
  /** How long the results of a preflight request can be cached */
  'Access-Control-Max-Age'?: string;
  /** Headers that will be used in the actual request in CORS */
  'Access-Control-Request-Headers'?: string;
  /** Method that will be used in the actual request in CORS */
  'Access-Control-Request-Method'?: string;
  /** Origin of the request */
  Origin?: string;
  /** Origins that are allowed to see timing information */
  'Timing-Allow-Origin'?: string;
  /** How the content should be presented */
  'Content-Disposition'?: string;
  /** Size of the resource in bytes */
  'Content-Length'?: string;
  /** The media type of the resource */
  'Content-Type'?: (typeof ContentType)[keyof typeof ContentType] | string;
  /** Encoding used on the resource */
  'Content-Encoding'?: string;
  /** Language of the content */
  'Content-Language'?: string;
  /** Alternate location for the resource */
  'Content-Location'?: string;
  /** Contains information from proxies about the client */
  Forwarded?: string;
  /** Informs about proxies through which the request was sent */
  Via?: string;
  /** URL to redirect to */
  Location?: string;
  /** URL to refresh to after a specified time */
  Refresh?: string;
  /** Email address of the person making the request */
  From?: string;
  /** Domain name of the server */
  Host?: string;
  /** Address of the previous web page */
  Referer?: string;
  /** Referrer policy for the request */
  'Referrer-Policy'?: string;
  /** Information about the user agent */
  'User-Agent'?: string;
  /** HTTP methods supported by the resource */
  Allow?: string;
  /** Information about the server */
  Server?: string;
  /** Range of bytes requested from the resource */
  Range?: string;
  /** Ranges that the server supports */
  'Accept-Ranges'?: string;
  /** Range of bytes being sent */
  'Content-Range'?: string;
  /** Makes a range request conditional */
  'If-Range'?: string;
  /** Controls resource embedding */
  'Cross-Origin-Embedder-Policy'?: string;
  /** Controls window opening behavior */
  'Cross-Origin-Opener-Policy'?: string;
  /** Controls resource sharing */
  'Cross-Origin-Resource-Policy'?: string;
  /** Content security policy directives */
  'Content-Security-Policy'?: string;
  /** Content security policy directives in report-only mode */
  'Content-Security-Policy-Report-Only'?: string;
  /** Permissions policy directives */
  'Permissions-Policy'?: string;
  /** HTTPS enforcement policy */
  'Strict-Transport-Security'?: string;
  /** Instructs the browser to upgrade insecure requests */
  'Upgrade-Insecure-Requests'?: string;
  /** Prevents MIME type sniffing */
  'X-Content-Type-Options'?: string;
  /** Controls how the page can be embedded in frames */
  'X-Frames-Options'?: string;
  /** Controls cross-domain policies */
  'X-Permitted-Cross-Domain-Policies'?: string;
  /** Information about the server software */
  'X-Powered-By'?: string;
  /** Controls XSS protection */
  'X-XSS-Protection'?: string;
  /** Reporting endpoint for various policies */
  'Report-To'?: string;
  /** Transfer encodings the user agent is willing to accept */
  TE?: string;
  /** Headers that will be in the trailer of a chunked transfer encoding */
  Trailer?: string;
  /** Encoding format of the message */
  'Transfer-Encoding'?: string;
  /** Alternative services available */
  'Alt-Svc'?: string;
  /** Alternative service used */
  'Alt-Used'?: string;
  /** Date and time at which the message was originated */
  Date?: string;
  /** Links to related resources */
  Link?: string;
  /** How long to wait before retrying */
  'Retry-After'?: string;
  /** Server timing information */
  'Server-Timing'?: string;
  /** Path that service workers are allowed to control */
  'Service-Worker-Allowed'?: string;
  /** Link to the source map */
  SourceMap?: string;
  /** Protocols that the server supports for upgrade */
  Upgrade?: string;
  /** Request priority */
  Priority?: string;
  /** Global Privacy Control signal */
  'Sec-GPC'?: string;
  /* eslint-enable @typescript-eslint/naming-convention */
}

/**
 * Represents the response body
 *
 * This type is a generic wrapper for the response body content,
 * allowing for type-safe responses with custom data structures.
 *
 * @template T - The type of the response body content
 */
export type TResponseBody<T> = T;

/**
 * Represents an HTTP response
 *
 * This interface defines the structure of an HTTP response,
 * including status, headers, and body content.
 */
export interface IResponse {
  /** The HTTP status text (e.g., 'OK', 'Not Found') */
  status: THttpStatus;
  /** The HTTP status code (e.g., 200, 404) */
  statusCode: THttpStatusCode;
  /** The protocol used for the response (e.g., 'http', 'https') */
  protocol: string;
  /** The HTTP method of the original request */
  method: THttpMethod;
  /** The path of the original request */
  path: string;
  /** Response headers as key-value pairs */
  headers: IHeaders;
  /** The response body content */
  body: TResponseBody<unknown>;
}
