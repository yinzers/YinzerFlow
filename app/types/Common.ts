/**
 * Extracts the union type of all values in an enum-like object
 *
 * This utility type takes an object with string or number values (like a TypeScript enum)
 * and creates a union type of all its values. This is useful for creating types
 * that are restricted to the specific values in the enum.
 *
 * @example
 * ```typescript
 * const Colors = { RED: 'red', GREEN: 'green', BLUE: 'blue' } as const;
 * type Color = Enum<typeof Colors>; // 'red' | 'green' | 'blue'
 * ```
 *
 * @template T - An object type with string or number values
 */
export type Enum<T> = T[keyof T];
