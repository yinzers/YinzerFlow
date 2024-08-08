import type { IRequest } from 'root/HttpRequest.ts';
import divideStringUtils from 'utils/divideString.utils.ts';

export default (headers: string): IRequest['headers'] => {
  const parsedHeaders: IRequest['headers'] = {};

  for (const header of headers.split('\r\n')) {
    if (!header.includes(': ')) throw new Error('Invalid header');
    const [key, value] = divideStringUtils(header, ': ');
    if (!key || !value) throw new Error('Invalid header');

    Object.assign(parsedHeaders, { [key]: value });
  }

  return parsedHeaders;
};
