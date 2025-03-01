import type { TMiddleware } from '../types/Middleware.ts';
import type { TUndefinableResponseFunction } from '../types/Route.ts';

/**
 * Manages middleware registration and execution
 */
export class MiddlewareManager {
  private readonly middleware: Array<TMiddleware> = [];

  /**
   * Get all registered middleware
   */
  getMiddleware(): Array<TMiddleware> {
    return this.middleware;
  }

  /**
   * Add middleware to be executed before route handlers
   */
  add(
    fn: TUndefinableResponseFunction,
    options?: {
      paths?: Array<string> | 'allButExcluded';
      excluded?: Array<string>;
    },
  ): void {
    if (!options) {
      this.middleware.push({ paths: [], excluded: [], fn });
      return;
    }

    if (options.paths === 'allButExcluded' && Array.isArray(options.excluded)) {
      this.middleware.push({ paths: 'allButExcluded', excluded: options.excluded, fn });
      return;
    }

    if (Array.isArray(options.paths)) {
      this.middleware.push({ paths: options.paths, excluded: [], fn });
      return;
    }

    // Default case
    this.middleware.push({ paths: [], excluded: [], fn });
  }

  /**
   * Add middleware with options
   * @param middleware The middleware function to add
   * @param options Options for the middleware (paths, excluded, exact)
   */
  addMiddleware(
    middleware: (ctx: unknown, next: () => Promise<unknown>) => unknown,
    options: {
      paths: Array<string> | 'all' | 'allButExcluded';
      excluded?: Array<string>;
      exact?: boolean;
    },
  ): void {
    this.middleware.push(<TMiddleware>(<unknown>{
      middleware,
      options: {
        paths: options.paths,
        excluded: options.excluded ?? [],
        exact: options.exact ?? false,
      },
    }));
  }

  /**
   * Get middleware that should be executed for a specific path
   * @param path The path to get middleware for
   * @returns Array of middleware functions that should be executed for the path
   */
  getMiddlewareForPath(path: string): Array<(ctx: unknown, next: () => Promise<unknown>) => unknown> {
    const result: Array<(ctx: unknown, next: () => Promise<unknown>) => unknown> = [];

    for (const mw of this.middleware) {
      const middleware = <
        {
          middleware: (ctx: unknown, next: () => Promise<unknown>) => unknown;
          options: {
            paths: Array<string> | 'all' | 'allButExcluded';
            excluded: Array<string>;
            exact: boolean;
          };
        }
      >(<unknown>mw);

      // Global middleware (applies to all paths)
      if (middleware.options.paths === 'all') {
        result.push(middleware.middleware);
        continue;
      }

      // Middleware that applies to all paths except excluded ones
      if (middleware.options.paths === 'allButExcluded' && !middleware.options.excluded.includes(path)) {
        result.push(middleware.middleware);
        continue;
      }

      // Path-specific middleware
      if (Array.isArray(middleware.options.paths)) {
        const isExactMatch = middleware.options.paths.includes(path);

        // Handle exact matching if specified
        if (middleware.options.exact) {
          if (isExactMatch) {
            result.push(middleware.middleware);
          }
          continue;
        }

        // Handle subpath matching (default behavior)
        const isSubpathMatch = middleware.options.paths.some(
          (p) =>
            path === p || // Exact match
            path.startsWith(`${p}/`) || // Subpath
            (path.endsWith('/') && path.slice(0, -1) === p), // Trailing slash
        );

        if (isExactMatch || isSubpathMatch) {
          result.push(middleware.middleware);
        }
      }
    }

    return result;
  }
}
