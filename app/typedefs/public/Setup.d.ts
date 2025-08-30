import type { InternalSetupMethod } from '@typedefs/internal/InternalSetupImpl.d.ts';
import type { InternalGlobalHookOptions } from '@typedefs/internal/InternalHookRegistryImpl.ts';
import type { HandlerCallback } from '@typedefs/public/Context.ts';
import type { InternalRouteRegistryOptions } from '@typedefs/internal/InternalRouteRegistryImpl.js';
import type { InternalGroupApp } from '@core/setup/GroupApp.js';

export type RouteGroup = InternalGroupApp;

export interface Setup {
  get: InternalSetupMethod;
  post: InternalSetupMethod;
  put: InternalSetupMethod;
  patch: InternalSetupMethod;
  delete: InternalSetupMethod;
  options: InternalSetupMethod;
  group: (prefix: string, callback: (group: InternalGroupApp) => void, options?: InternalRouteRegistryOptions) => InternalGroupApp;
  beforeAll: (handlers: Array<HandlerCallback>, options?: InternalGlobalHookOptions) => void;
  afterAll: (handlers: Array<HandlerCallback>, options?: InternalGlobalHookOptions) => void;
  onError: (handler: HandlerCallback) => void;
  onNotFound: (handler: HandlerCallback) => void;
}
