/**
 * Parse the query string from the path
 *
 * @example
 * ```ts
 * parseQuery('https://example.com/path?key1=value1&key2=value2');
 * // Returns { key1: 'value1', key2: 'value2' }
 * ```
 */
export const parseQuery = (path: string): Record<string, string> => {
  if (!path) return {};

  if (!path.includes('?')) return {};

  const [, queryString] = path.split('?');
  if (!queryString) return {};

  const params: Record<string, string> = {};
  const pairs = queryString.split('&');

  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key) {
      try {
        const decodedKey = decodeURIComponent(key);
        const decodedValue = value ? decodeURIComponent(value) : '';
        params[decodedKey] = decodedValue;
      } catch {
        // If decoding fails, use the original values
        params[key] = value ?? '';
      }
    }
  }

  return params;
};
