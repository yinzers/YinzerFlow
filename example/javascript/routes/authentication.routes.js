import { YinzerFlow } from 'yinzerflow';

const app = new YinzerFlow();

export default [
  app.post(
    '/register',
    ({ response }) => {
      // Register user
      response.setStatus(201);
      return { success: true, message: 'User registered' };
    },
    {
      beforeHandler: ({ response }) => {
        // Some validation
        response.setStatus(400);
        return { success: false, message: 'Invalid request' };
      },
    },
  ),
  app.post('/login', () => ({ success: true, message: 'Login successful' })),
  app.post('/logout', () => ({ success: true, message: 'Logout successful' })),
];
