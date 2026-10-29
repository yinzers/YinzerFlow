import type { InternalHttpMethod } from '@typedefs/constants/http.js';
import { httpMethod } from '@constants/http.ts';
import { divideString } from '@core/utils/string.ts';

/**
 * RFC 9112 §3 request line: method, one SP, request-target, one SP, HTTP/1.0 or HTTP/1.1, and nothing else. No `m` flag,
 * so `$` is the end of the line divideString cut: a bare LF (or any other byte) after the version fails the match.
 */
const requestLinePattern = /^(?<method>\S+) (?<target>\S+) (?<protocol>HTTP\/1\.[01])$/;

/**
 * Parse raw HTTP request string into its components that are needed for the request builder.
 *
 * This is the one request-line parser: HTTP requests and WebSocket upgrades both read method, target and protocol
 * from it. A line that doesn't match the RFC 9112 grammar (tabs or repeated spaces as separators, trailing bytes,
 * a version other than HTTP/1.0 or 1.1, a missing part) gets `isRequestLineValid: false`, and the caller answers 400;
 * the other fields then hold safe fallbacks (method GET, protocol HTTP/1.1) and are never echoed.
 * A well-formed line with a method YinzerFlow doesn't route is still read as GET, as before.
 *
 * @example
 * ```ts
 * parseHttpRequest('GET /path?key1=value1&key2=value2 HTTP/1.1\r\nHost: example.com\r\n\r\n');
 * // Returns { method: 'GET', path: '/path?key1=value1&key2=value2', protocol: 'HTTP/1.1', headersRaw: 'Host: example.com',
 * //           rawBody: '', isRequestLineValid: true }
 * ```
 */
export const parseHttpRequest = (
  request: string,
): { method: InternalHttpMethod; path: string; protocol: string; headersRaw: string; rawBody: string; isRequestLineValid: boolean } => {
  // RFC 9112 §2.2: a server SHOULD ignore empty lines received before the request line. The caller bounds how many
  // can arrive (the connection's buffer cap), and this anchored strip is linear.
  const [firstLine, rest] = divideString(request.replace(/^[\r\n]+/, ''), '\r\n');
  const [headersRaw, rawBody] = divideString(rest, '\r\n\r\n');
  const groups = requestLinePattern.exec(firstLine)?.groups;

  if (!groups?.method || !groups.target || !groups.protocol) {
    return { method: httpMethod.get, path: firstLine.split(' ')[1] ?? '/', protocol: 'HTTP/1.1', headersRaw, rawBody, isRequestLineValid: false };
  }

  const isKnownMethod = Object.values(httpMethod).includes(groups.method as InternalHttpMethod);
  return {
    method: isKnownMethod ? (groups.method as InternalHttpMethod) : httpMethod.get,
    path: groups.target,
    protocol: groups.protocol,
    headersRaw,
    rawBody,
    isRequestLineValid: true,
  };
};
