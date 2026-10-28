/**
 * Internal types for RequestHandlerImpl's request pipeline.
 */

/** A route found by a lookup the global stages run: an HTTP route, or a WebSocket route on an upgrade. */
export interface InternalStageRoute {
  params: Record<string, string>;
}

/**
 * Outcome of the global before-handler stages (beforeRouting, route lookup, global rate limiter, beforeAll).
 * `answered` means a stage has already set the response; otherwise `route` is the lookup's match, or undefined when
 * nothing matched and the not-found handler should answer.
 */
export type InternalGlobalStagesResult<TRoute extends InternalStageRoute> = { answered: false; route: TRoute | undefined } | { answered: true };
