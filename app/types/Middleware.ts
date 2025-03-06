import type { TUndefinableResponseFunction } from './Route.ts';

/**
 * Base interface for middleware configurations
 * 
 * This interface defines the common structure for all middleware types,
 * containing the middleware function to be executed.
 */
interface IMiddleware {
  /** The middleware function to execute */
  fn: TUndefinableResponseFunction;
}

/**
 * Middleware configuration for excluding specific paths
 * 
 * This interface defines middleware that applies to all paths except those
 * explicitly excluded. This is useful for global middleware with exceptions.
 */
export interface IExcludeMiddleware extends IMiddleware {
  /** Special value indicating this middleware applies to all paths except excluded ones */
  paths: 'allButExcluded';
  /** Array of path patterns to exclude from middleware execution */
  excluded: Array<string>;
}

/**
 * Middleware configuration for including specific paths
 * 
 * This interface defines middleware that only applies to the specified paths.
 * This is useful for path-specific middleware.
 */
export interface IIncludeMiddleware extends IMiddleware {
  /** Array of path patterns where this middleware should be applied */
  paths: Array<string>;
  /** Empty array as this middleware type doesn't exclude paths */
  excluded: [];
}

/**
 * Union type for all middleware configurations
 * 
 * This type represents either an include middleware (applies only to specified paths)
 * or an exclude middleware (applies to all paths except those excluded).
 */
export type TMiddleware = IExcludeMiddleware | IIncludeMiddleware;
