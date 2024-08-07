import type { THttpStatusCode, TResponseBody } from 'yinzerflow';
import { HttpStatusCode, YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow();

export default [
  app.post(
    '/register',
    ({ response }): TResponseBody<{ success: boolean; message: string }> => {
      // Register user
      response.setStatus(<THttpStatusCode>HttpStatusCode.CREATED);
      return { success: true, message: 'User registered' };
    },
    {
      beforeHandler: ({ response }): TResponseBody<{ success: boolean; message: string }> => {
        response.setStatus(<THttpStatusCode>HttpStatusCode.BAD_REQUEST);
        return { success: false, message: 'Invalid request' };
      },
    },
  ),
  app.post('/login', (): TResponseBody<{ success: boolean; message: string }> => ({ success: true, message: 'Login successful' })),
  app.post('/logout', (): TResponseBody<{ success: boolean; message: string }> => ({ success: true, message: 'Logout successful' })),
];
