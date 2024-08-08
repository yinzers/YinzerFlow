import type { IRequest } from 'root/HttpRequest.ts';

export default (headers: IRequest['headers'], body: string): IRequest['body'] => {
  if (!headers['Content-Type']) throw new Error('Missing Content-Type header');

  let parsedBody: IRequest['body'] = {};
  if (headers['Content-Type'] === 'application/json') parsedBody = handleApplicationJson(body);

  if (headers['Content-Type'] === 'application/x-www-form-urlencoded') parsedBody = handleXwwwFormUrlencoded(body);

  if (headers['Content-Type'].includes('multipart/form-data')) parsedBody = handleMultipartFormData(body);

  return parsedBody;
};

const handleApplicationJson = (body: string): IRequest['body'] => {
  try {
    return <IRequest['body']>JSON.parse(body);
  } catch (_error) {
    throw new Error('Invalid body');
  }
};

const handleXwwwFormUrlencoded = (body: string): IRequest['body'] => {
  const parsedBody: IRequest['body'] = {};

  for (const pair of body.split('&')) {
    if (!pair) continue;
    const [key, value] = pair.split('=', 2);
    if (!key || !value) continue;
    Object.assign(parsedBody, { [key]: value });
  }

  return parsedBody;
};

const handleMultipartFormData = (body: string): IRequest['body'] => {
  const parsedBody = {};

  if (body.includes('Content-Type')) throw new Error('Body type not supported yet');

  const parts = body.split('Content-Disposition: form-data;');
  for (const part of parts) {
    if (!part || !part.includes('name')) continue;
    let [, key] = part.split('name="', 2);
    if (!key) continue;
    [key] = key.split('"', 1);
    if (!key) continue;

    let [, value] = part.split('\r\n\r\n', 2);
    if (!value) continue;
    value = value.slice(0, value.indexOf('\r\n'));

    Object.assign(parsedBody, { [key]: value });
  }

  return parsedBody;
};
