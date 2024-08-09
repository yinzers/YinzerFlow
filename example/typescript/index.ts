import { HttpStatusCode, YinzerFlow } from 'yinzerflow';
import type { THttpStatusCode, TResponseBody } from 'yinzerflow';
import authenticationMiddleware from 'example/typescript/middleware/authentication.middleware.ts';
import authenticationRoutes from 'example/typescript/routes/authentication.routes.ts';

export const app = new YinzerFlow({
  port: 5000,
  errorHandler: ({ response }, error): TResponseBody<unknown> => {
    /* eslint-disable-next-line no-console */
    console.error('Server error: \n', error);
    response.setStatus(<THttpStatusCode>HttpStatusCode.TOO_MANY_REQUESTS);
    return { success: false, message: 'Internal server error' };
  },
});

app.beforeAll(authenticationMiddleware, { paths: 'allButExcluded', excluded: ['/auth/login', '/auth/register', '/status'] });

app.get('/status', () => ({ success: true, body: 'Server is running' }));

app.group('/auth', authenticationRoutes, {
  beforeGroup: ({ response }): TResponseBody<{ success: boolean; message: string }> => {
    // A throttle middleware can be added here
    response.setStatus(<THttpStatusCode>HttpStatusCode.TOO_MANY_REQUESTS);
    return { success: false, message: 'Too many requests' };
  },
});

app.listen();
