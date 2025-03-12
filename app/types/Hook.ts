import type { TUndefinableResponseFunction } from 'types/Route.ts';

/**
 * Base interface for hook configurations
 *
 * This interface defines the common structure for all hook types,
 * containing the hook function to be executed.
 */
interface IHook {
  /** The hook function to execute */
  fn: TUndefinableResponseFunction;
}

/**
 * Hook configuration for excluding specific paths
 *
 * This interface defines hooks that apply to all paths except those
 * explicitly excluded. This is useful for global hooks with exceptions.
 */
export interface IExcludeHook extends IHook {
  /** Special value indicating this hook applies to all paths except excluded ones */
  paths: 'allButExcluded';
  /** Array of path patterns to exclude from hook execution */
  excluded: Array<string>;
}

/**
 * Hook configuration for including specific paths
 *
 * This interface defines hooks that only apply to the specified paths.
 * This is useful for path-specific hooks.
 */
export interface IIncludeHook extends IHook {
  /** Array of path patterns where this hook should be applied */
  paths: Array<string>;
  /** Array of path patterns to exclude from hook execution */
  excluded: Array<string>;
}

/**
 * Union type for all hook configurations
 *
 * This type represents either an include hook (applies only to specified paths)
 * or an exclude hook (applies to all paths except those excluded).
 */
export type THook = IExcludeHook | IIncludeHook;
