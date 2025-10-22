import type { httpMethod } from '@constants/http.ts';

const createHttpRequest = async ({
  testPort,
  method,
  path,
  headers,
  body,
}: {
  testPort: number;
  method: keyof typeof httpMethod;
  path: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | undefined;
}) => {
  const response = await fetch(`http://localhost:${testPort}/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return response;
};

const defaultPath = '/test';
const defaultBody: Record<string, unknown> = { test: 'test' };
const defaultHeaders: Record<string, string> = {};

export const getRequest = async ({ testPort }: { testPort: number }): Promise<Response> => {
  return createHttpRequest({ testPort, method: 'get', path: defaultPath, headers: defaultHeaders, body: undefined });
};

export const postRequest = async ({ testPort }: { testPort: number }): Promise<Response> => {
  return createHttpRequest({ testPort, method: 'post', path: defaultPath, headers: defaultHeaders, body: defaultBody });
};

export const putRequest = async ({ testPort }: { testPort: number }): Promise<Response> => {
  return createHttpRequest({ testPort, method: 'put', path: defaultPath, headers: defaultHeaders, body: defaultBody });
};

export const deleteRequest = async ({ testPort }: { testPort: number }): Promise<Response> => {
  return createHttpRequest({ testPort, method: 'delete', path: defaultPath, headers: defaultHeaders, body: defaultBody });
};

export const patchRequest = async ({ testPort }: { testPort: number }): Promise<Response> => {
  return createHttpRequest({ testPort, method: 'patch', path: defaultPath, headers: defaultHeaders, body: defaultBody });
};

export const optionsRequest = async ({ testPort }: { testPort: number }): Promise<Response> => {
  return createHttpRequest({ testPort, method: 'options', path: defaultPath, headers: defaultHeaders, body: undefined });
};
