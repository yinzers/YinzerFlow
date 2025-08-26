import type { InternalHttpMethod } from '@typedefs/constants/http.ts';
import type { InternalSetupMethod } from '@typedefs/internal/InternalSetupImpl.d.ts';
import type { InternalGlobalHookOptions } from '@typedefs/internal/InternalHookRegistryImpl.ts';
import type { HandlerCallback } from '@typedefs/public/Context.ts';

export type RouteGroup = Record<Lowercase<InternalHttpMethod>, InternalSetupMethod>;

export interface Setup {
  get: InternalSetupMethod;
  post: InternalSetupMethod;
  put: InternalSetupMethod;
  patch: InternalSetupMethod;
  delete: InternalSetupMethod;
  options: InternalSetupMethod;
  group: (prefix: string, callback: (group: RouteGroup) => void, options?: InternalRouteRegistryOptions) => void;
  beforeAll: (handlers: Array<HandlerCallback>, options?: InternalGlobalHookOptions) => void;
  afterAll: (handlers: Array<HandlerCallback>, options?: InternalGlobalHookOptions) => void;
  onError: (handler: HandlerCallback) => void;
  onNotFound: (handler: HandlerCallback) => void;
}
