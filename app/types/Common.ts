export type Enum<T> = T[keyof T];

export interface Context {
  request: {
    method: string;
    path: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
    query: Record<string, string>;
    params: Record<string, string>;
    [key: string]: unknown;
  };
  response: {
    setStatus: (status: number) => void;
    getStatus: () => number;
    setBody: (body: unknown) => void;
    getBody: () => unknown;
    setContentType: (contentType: string) => void;
    getContentType: () => string;
    addHeaders: (headers: Array<Record<string, string>>) => void;
    getHeaders: () => Record<string, string>;
    removeHeaders: (headers: Array<string>) => void;
    setCookie: (name: string, value: string, options?: unknown) => void;
    getCookies: () => Record<string, string>;
    removeCookie: (name: string) => void;
    formatHttpResponse: () => string;
    [key: string]: unknown;
  };
}
