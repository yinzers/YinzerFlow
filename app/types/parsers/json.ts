/**
 * Represents JSON data parsed from a request
 *
 * This type provides a generic object representation of JSON data.
 */
export type TJsonData<T = unknown> = Record<string, unknown> & T;
