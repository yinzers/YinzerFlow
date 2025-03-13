/**
 * Route Barrel File
 *
 * This file re-exports all route related exports from the route directory
 * to provide a cleaner import experience while maintaining tree-shakability.
 */

export { RouteRegistry } from 'core/Route/RouteRegistry.ts';
export { RouteFinder } from 'core/Route/RouteFinder.ts';

// Route methods
export { addGetRoute, addPostRoute, addPutRoute, addDeleteRoute, addPatchRoute } from 'core/Route/methods/index.ts';
