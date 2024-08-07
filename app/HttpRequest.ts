import type { Enum } from 'root/index.ts';

export const HttpMethod = <const>{
  DELETE: 'DELETE',
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  HEAD: 'HEAD',
  OPTIONS: 'OPTIONS',
};
export type THttpMethod = Enum<typeof HttpMethod>;

interface IRequest {
  protocol: string;
  method: THttpMethod;
  path: string;
  headers: Array<Record<string, string>>;
  body?: string;
}

export default class HttpRequest {
  readonly protocol: IRequest['protocol'];
  readonly method: IRequest['method'];
  readonly path: IRequest['path'];
  readonly headers: IRequest['headers'];
  readonly body: IRequest['body'];

  constructor(request: string) {
    const { protocol, method, path, headers, body } = this._parseRequest(request);
    this.protocol = protocol;
    this.method = method;
    this.path = path;
    this.headers = headers;
    this.body = body;
  }

  private _parseRequest(request: string): IRequest {
    /**
     * Validate the request
     */
    if (!request) throw new Error('Invalid request');

    /**
     * The request is a string that contains the following information:
     * - The first line contains the request method, path, and protocol
     * - The headers are separated from the body by two newlines
     */
    const [firstLine, rest] = this._divideStringOn(request, '\r\n');
    const [method, path, protocol] = <[THttpMethod, string, string]>firstLine.split(' ', 3);
    /* eslint-disable-next-line prefer-const */
    let [headers, body] = this._divideStringOn(rest, '\r\n\r\n');

    const parsedHeaders = [];
    for (const header of headers.split('\r\n')) {
      if (!header.includes(': ')) throw new Error('Invalid header');
      const [key, value] = this._divideStringOn(header, ': ');
      if (!key || !value) throw new Error('Invalid header');
      parsedHeaders.push({ key, value });
    }

    /**
     * If the request method is GET or HEAD, the request body is empty
     * This is because GET and HEAD requests are used to retrieve information from the server
     * but do not send any data to the server
     */
    if (method === HttpMethod.GET || method === HttpMethod.HEAD) return { protocol, method, path, headers: parsedHeaders };
    return { protocol, method, path, headers: parsedHeaders, body };
  }

  private _divideStringOn(s: string, search: string): [string, string] {
    const index = s.indexOf(search);
    const first = s.slice(0, index);
    const rest = s.slice(index + search.length);
    return [first, rest];
  }
}
