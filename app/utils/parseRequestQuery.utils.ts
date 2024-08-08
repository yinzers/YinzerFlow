import type { IRequest, TRequestBody } from 'root/HttpRequest.ts';

export default (path: IRequest['path']): TRequestBody => {
  const parsedQuery: TRequestBody<Record<string, unknown>> = {};
  const queryIndex = path.indexOf('?');

  if (queryIndex === -1) return parsedQuery;

  const queryString = path.slice(queryIndex + 1);
  const queryParts = queryString.split('&');

  for (const queryPart of queryParts) {
    if (!queryPart.includes('=')) throw new Error('Invalid query');
    const [key, value] = queryPart.split('=');
    if (!key || !value) throw new Error('Invalid query');

    Object.assign(parsedQuery, { [key]: value });
  }

  return parsedQuery;
};
