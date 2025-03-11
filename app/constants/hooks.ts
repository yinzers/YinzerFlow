import type { Enum } from 'types/Common.ts';

/**
 * Hook execution phases
 *
 * These constants define the different phases of hook execution
 * in the request lifecycle.
 */
export const HookPhase = <const>{
  /** Executed before any route-specific hooks */
  BEFORE_ALL: 'before:all',
  /** Executed for routes in a specific group */
  BEFORE_GROUP: 'before:group',
  /** Executed before a specific route handler */
  BEFORE_HANDLER: 'before:handler',
  /** Executed after a specific route handler */
  AFTER_HANDLER: 'after:handler',
};

/**
 * Type for HookPhase values
 */
export type THookPhase = Enum<typeof HookPhase>;

/**
 * Events emitted by HooksManager
 *
 * These constants are used for the event system in the hooks components.
 */
export const HookManagerEvent = <const>{
  /** Emitted when a hook is added */
  HOOK_ADDED: 'hook:added',
  /** Emitted when a hook is executed */
  HOOK_EXECUTED: 'hook:executed',
  /** Emitted when a hook is executed before all routes */
  BEFORE_ALL_EXECUTED: 'hook:before:all:executed',
  /** Emitted when a hook is executed before a group */
  BEFORE_GROUP_EXECUTED: 'hook:before:group:executed',
  /** Emitted when a hook is executed before a handler */
  BEFORE_HANDLER_EXECUTED: 'hook:before:handler:executed',
  /** Emitted when a hook is executed after a handler */
  AFTER_HANDLER_EXECUTED: 'hook:after:handler:executed',
};

/**
 * Type for HookManagerEvent values
 */
export type THookManagerEvent = Enum<typeof HookManagerEvent>;

/**
 * Special path matching patterns
 */
export const PathMatchingPattern = <const>{
  /** Apply hooks to all paths except those explicitly excluded */
  ALL_BUT_EXCLUDED: 'allButExcluded',
};
