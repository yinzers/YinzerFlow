import type { Enum } from 'types/Common.ts';

/**
 * Events emitted by RouteRegistry
 *
 * These constants are used for the event system in the routing components.
 * Using 'as const' provides better type safety than enums.
 */
export const RouteRegistryEvent = <const>{
  /** Emitted when a new route is added */
  ROUTE_ADDED: 'route:added',
  /** Emitted when a route is removed */
  ROUTE_REMOVED: 'route:removed',
  /** Emitted when any change is made to the routes collection */
  ROUTES_CHANGED: 'routes:changed',
};

/**
 * Type for RouteRegistryEvent values
 * This creates a union type of all the string literal values
 */
export type TRouteRegistryEvent = Enum<typeof RouteRegistryEvent>;
