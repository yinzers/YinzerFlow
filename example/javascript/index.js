import { YinzerFlow } from 'yinzerflow';
import authenticationMiddleware from './middleware/authentication.middleware.js';
import authenticationRoutes from './routes/authentication.routes.js';

export const app = new YinzerFlow({
  port: 5000,
});

app.beforeAll(authenticationMiddleware, { paths: 'allButExcluded', excluded: ['/auth/login', '/auth/register', '/status'] });

app.get('/status', () => ({ success: true, body: 'Server is running' }));

app.group('/auth', authenticationRoutes, {
  beforeGroup: ({ response }) => {
    // A throttle middleware can be added here
    response.setStatus(429);
    return { success: false, message: 'Too many requests' };
  },
});

app.listen();
