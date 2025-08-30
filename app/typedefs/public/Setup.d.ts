import type { InternalGlobalHookOptions } from '@typedefs/internal/InternalHookRegistryImpl.ts';
import type { HandlerCallback } from '@typedefs/public/Context.ts';
import type { InternalGroupApp } from '@core/setup/GroupApp.js';
import type { HttpMethodHandlers, RouteGroupMethod } from '@core/setup/utils/routeUtils.js';

export type RouteGroup = InternalGroupApp;

export interface Setup extends HttpMethodHandlers {
  group: RouteGroupMethod;
  beforeAll: (handlers: Array<HandlerCallback>, options?: InternalGlobalHookOptions) => void;
  afterAll: (handlers: Array<HandlerCallback>, options?: InternalGlobalHookOptions) => void;
  onError: (handler: HandlerCallback) => void;
  onNotFound: (handler: HandlerCallback) => void;
}
