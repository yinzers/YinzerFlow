import type { IRequest } from 'root/HttpRequest.ts';

export default (path: IRequest['path']): IRequest['query'] => {
  const parsedQuery: IRequest['query'] = {};
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
