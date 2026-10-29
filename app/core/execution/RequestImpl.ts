import { parseBody } from './utils/parseBody.ts';
import type { InternalContentType, InternalHttpHeaders, InternalHttpMethod } from '@typedefs/constants/http.js';
import { parseHttpRequest } from '@core/execution/utils/parseHttpRequest.ts';
import { parseQuery } from '@core/execution/utils/parseQuery.ts';
import { parseIpAddress } from '@core/execution/utils/parseIpAddress.ts';
import { extractBoundaryFromHeader } from '@core/execution/utils/extractBoundaryFromHeader.ts';
import { parseRequestHeaders } from '@core/execution/utils/parseRequestHeaders.ts';
import type { Request } from '@typedefs/public/Request.ts';
import type { SetupImpl } from '@core/setup/SetupImpl.ts';
import type { InternalRequestImpl } from '@typedefs/internal/InternalRequestImpl.ts';
import type { InternalSetupImpl } from '@typedefs/internal/InternalSetupImpl.ts';

export class RequestImpl implements InternalRequestImpl {
  readonly _rawRequest: Buffer | string;
  readonly _setup: InternalSetupImpl;

  method: InternalHttpMethod;
  path: string;
  protocol: string;
  headers: Partial<Record<InternalHttpHeaders, string>>;
  body: unknown;
  query: Record<string, unknown>;
  params: Record<string, string>;
  ipAddress: string;
  rawBody: Buffer | string;
  readonly _isRequestLineValid: boolean;
  readonly _repeatedHeaders: ReadonlySet<string>;
  readonly _isHeaderBlockValid: boolean;
  cookies = new Map<string, string>();
  signedCookies = new Map<string, string>();

  constructor(rawRequest: Request['rawBody'], setup: SetupImpl, clientAddress?: string) {
    this._rawRequest = rawRequest;
    this._setup = setup;

    const { method, path, protocol, headers, body, query, params, rawBody, _isRequestLineValid, _repeatedHeaders, _isHeaderBlockValid } =
      this._parseRequestIntoObject();

    this._isRequestLineValid = _isRequestLineValid;
    this._repeatedHeaders = _repeatedHeaders;
    this._isHeaderBlockValid = _isHeaderBlockValid;
    this.method = method;
    this.path = path;
    this.protocol = protocol;
    this.headers = headers;
    this.body = body;
    this.query = query ?? {};
    this.params = params ?? {};
    this.rawBody = rawBody;

    // The socket address, unless the socket peer is a trusted proxy whose forwarded headers name the client
    this.ipAddress = parseIpAddress(this._setup, headers, clientAddress ?? '');
  }

  private _parseRequestIntoObject(): Omit<Request, 'cookies' | 'ipAddress' | 'signedCookies'> &
    Pick<InternalRequestImpl, '_isHeaderBlockValid' | '_isRequestLineValid' | '_repeatedHeaders'> {
    const request = this._rawRequest.toString();

    const { method, path, protocol, headersRaw, rawBody, isRequestLineValid } = parseHttpRequest(request);

    const headerReport = { repeatedNames: new Set<string>(), malformed: false };
    const headers = parseRequestHeaders(headersRaw, headerReport);

    // Extract content type and boundary for body parsing
    const contentTypeHeader = headers['content-type'];
    const mainContentType = contentTypeHeader?.split(';')[0]?.trim().toLowerCase() as InternalContentType;
    const boundary = extractBoundaryFromHeader(contentTypeHeader);

    return {
      method,
      path,
      protocol,
      headers,
      body: parseBody(rawBody, {
        headerContentType: mainContentType,
        boundary,
        config: this._setup._configuration.bodyParser,
        logger: this._setup._log,
      }),
      query: parseQuery(path),
      params: {}, // Route params will be set in RequestHandlerImpl when route is matched
      rawBody,
      _isRequestLineValid: isRequestLineValid,
      _repeatedHeaders: headerReport.repeatedNames,
      _isHeaderBlockValid: !headerReport.malformed,
    };
  }
}
