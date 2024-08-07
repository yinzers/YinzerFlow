import type HttpRequest from 'root/HttpRequest.ts';
import type HttpResponse from 'root/HttpResponse.ts';

export type TRequestBody<T> = Record<string, T>;

export class Context {
  request: HttpRequest;
  response: HttpResponse;

  constructor(request: HttpRequest, response: HttpResponse) {
    this.request = request;
    this.response = response;
  }
}
