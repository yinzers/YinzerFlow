import { HttpStatusCode } from 'yinzerflow';
import type { Context, THttpStatusCode, TResponseBody } from 'yinzerflow';

export default ({ response }: Context): TResponseBody<{ success: boolean; message: string }> => {
  response.setStatus(<THttpStatusCode>HttpStatusCode.UNAUTHORIZED);
  return {
    success: false,
    message: 'Hello, World!',
  };
};
