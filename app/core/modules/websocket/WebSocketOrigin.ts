/**
 * Origin and Host parsing for the WebSocket origin policy. An origin is `scheme://host[:port]` (RFC 6454 serialization:
 * no path, no userinfo, no trailing slash); a Host header is `host[:port]`. Hosts are DNS names or bracketed IPv6.
 */

const _hostPattern = String.raw`(\[[0-9a-f:.]+\]|[a-z0-9_.-]+)`;
const _originPattern = new RegExp(String.raw`^([a-z][a-z0-9+.-]*)://${_hostPattern}(?::(\d{1,5}))?$`, 'i');
const _hostHeaderPattern = new RegExp(String.raw`^${_hostPattern}(?::(\d{1,5}))?$`, 'i');

const _defaultPorts: Partial<Record<string, number>> = { http: 80, ws: 80, https: 443, wss: 443 };

/**
 * The default port of a web scheme (http, ws, https, wss), or undefined for any other scheme.
 */
export const _defaultPortForScheme = (scheme: string): number | undefined => _defaultPorts[scheme];

/**
 * Parse a serialized origin into a lower-cased scheme and host plus an optional port. Returns null when it isn't one.
 */
export const _parseOrigin = (value: string): { scheme: string; host: string; port: number | undefined } | null => {
  const match = _originPattern.exec(value);
  if (!match) return null;
  const [, scheme = '', host = '', port] = match;
  return { scheme: scheme.toLowerCase(), host: host.toLowerCase(), port: port === undefined ? undefined : Number(port) };
};

/**
 * Parse a Host header into a lower-cased host and an optional port. Returns null when it isn't `host[:port]`.
 */
export const _parseHostHeader = (value: string): { host: string; port: number | undefined } | null => {
  const match = _hostHeaderPattern.exec(value.trim());
  if (!match) return null;
  const [, host = '', port] = match;
  return { host: host.toLowerCase(), port: port === undefined ? undefined : Number(port) };
};
