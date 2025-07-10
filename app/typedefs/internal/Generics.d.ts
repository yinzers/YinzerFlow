export type CreateEnum<T> = T[keyof T];

/**
 * Utility type for deep partial - makes all properties optional recursively
 * Used internally to create public configuration types from internal shapes
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ?
    T[P] extends Array<infer U> ?
      Array<U> // Keep arrays as-is, don't make array items partial
    : DeepPartial<T[P]>
  : T[P];
};

export interface InternalHandlerCallbackGenerics {
  body?: unknown;
  response?: unknown;
  query?: Record<string, string>;
  params?: Record<string, string>;
}
