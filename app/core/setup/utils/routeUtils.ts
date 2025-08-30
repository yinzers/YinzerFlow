import type { InternalRouteRegistryOptions } from '@typedefs/internal/InternalRouteRegistryImpl.js';
import type { InternalSetupMethod } from '@typedefs/internal/InternalSetupImpl.js';
import type { InternalGroupApp } from '@core/setup/GroupApp.js';
import type { httpMethod } from '@constants/http.ts';

/**
 * Utility type that maps HTTP methods to their handler functions
 * Ensures consistency between SetupImpl and GroupApp
 */
export type HttpMethodHandlers = Record<Lowercase<keyof typeof httpMethod>, InternalSetupMethod>;

/**
 * Route group method signature for consistent typing across interfaces
 * Used for both main setup and nested group registration
 */
export type RouteGroupMethod = (prefix: string, callback: (group: InternalGroupApp) => void, options?: InternalRouteRegistryOptions) => InternalGroupApp;

/**
 * Ensure route options are complete by filling in missing optional properties
 * This allows developers to specify only the hooks they need while maintaining
 * internal compatibility with the system
 */
export const ensureCompleteRouteOptions = (options?: InternalRouteRegistryOptions): InternalRouteRegistryOptions => ({
  beforeHooks: options?.beforeHooks ?? [],
  afterHooks: options?.afterHooks ?? [],
});

/**
 * Merge route options with proper hook ordering
 * - beforeHooks: parent hooks first, then child hooks
 * - afterHooks: child hooks first, then parent hooks
 * Handles optional hooks gracefully
 */
export const mergeRouteOptions = (parentOptions: InternalRouteRegistryOptions, childOptions?: InternalRouteRegistryOptions): InternalRouteRegistryOptions => ({
  beforeHooks: [...(parentOptions.beforeHooks ?? []), ...(childOptions?.beforeHooks ?? [])],
  afterHooks: [...(childOptions?.afterHooks ?? []), ...(parentOptions.afterHooks ?? [])],
});

/**
 * Build a route path by joining prefix and path segments
 * Handles leading/trailing slashes intelligently
 */
export const buildRoutePath = (prefix: string, path: string): string => {
  const cleanPrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanPrefix}${cleanPath}`;
};
