import type { TUndefinableResponseFunction } from './Route.ts';

interface IMiddleware {
  fn: TUndefinableResponseFunction;
}

export interface IExcludeMiddleware extends IMiddleware {
  paths: 'allButExcluded';
  excluded: Array<string>;
}

export interface IIncludeMiddleware extends IMiddleware {
  paths: Array<string>;
  excluded: [];
}

export type TMiddleware = IExcludeMiddleware | IIncludeMiddleware;
