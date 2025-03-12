/**
 * Core Barrel File
 *
 * This file re-exports the core components of the YinzerFlow framework
 * to provide a cleaner import experience while maintaining tree-shakability.
 */

// Main server class
export { YinzerFlow } from './YinzerFlow.ts';

// Core components
export { Context } from './Context.ts';
export { Request } from './Request.ts';
export { Response } from './Response.ts';
export { RequestHandler } from './RequestHandler.ts';
export { ConnectionManager } from './ConnectionManager.ts';
export { HooksManager } from './HooksManager.ts';

// Route components
export { RouteRegistry } from './Route/RouteRegistry.ts';
export { RouteFinder } from './Route/RouteFinder.ts';

// Route methods
export { addGetRoute, addPostRoute, addPutRoute, addDeleteRoute, addPatchRoute } from './Route/methods/index.ts';
