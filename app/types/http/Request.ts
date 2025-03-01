import type { Enum } from '../Common.ts';
import type { HttpMethod } from '../../constants/http.ts';
import type { IHeaders } from './Response.ts';

export type THttpMethod = Enum<typeof HttpMethod>;

export type TRequestBody<T = unknown> = T;
export type TRequestQuery<T = unknown> = T;
export type TRequestParams<T = unknown> = T;

export interface IRequest {
  protocol: string;
  method: THttpMethod;
  path: string;
  headers: IHeaders;
  body: TRequestBody | object;
  query: TRequestQuery | object;
  params: TRequestParams | object;
}
