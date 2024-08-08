import { YinzerFlow, HttpStatusCode } from 'yinzerflow';

const app = new YinzerFlow();

export default [
  app.post(
    '/register',
    ({ response }) => {
      // Register user
      response.setStatus(HttpStatusCode.CREATED);
      return { success: true, message: 'User registered' };
    },
    {
      beforeHandler: ({ response }) => {
        // Some validation
        response.setStatus(HttpStatusCode.BAD_REQUEST);
        return { success: false, message: 'Invalid request' };
      },
    },
  ),
  app.post('/login', () => ({ success: true, message: 'Login successful' })),
  app.post('/logout', () => ({ success: true, message: 'Logout successful' })),
];
