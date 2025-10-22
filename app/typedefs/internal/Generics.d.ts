import type { HandlerCallbackGenerics } from '@typedefs/public/HandlerCallbackGenerics.d.ts';

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

/**
 * Internal alias for HandlerCallbackGenerics
 *
 * This is kept for backward compatibility with internal code.
 * All new code should use HandlerCallbackGenerics directly.
 */
export type InternalHandlerCallbackGenerics = HandlerCallbackGenerics;
