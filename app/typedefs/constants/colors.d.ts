import type { CreateEnum } from '@typedefs/internal/Generics.js';

/**
 * ANSI Color codes for logging
 *
 * @example
 * ```typescript
 * console.log(`${colors.red}Error: ${message}${colors.reset}`);
 * ```
 */
export type Colors = CreateEnum<typeof colors>;
