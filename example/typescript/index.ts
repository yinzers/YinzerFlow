/**
 * YinzerFlow TypeScript Example
 *
 * This example demonstrates how to create a type-safe HTTP server using YinzerFlow
 * with routes, middleware, and error handling.
 */

import { HttpStatusCode, YinzerFlow } from 'yinzerflow';
import type { Context, THttpStatusCode, TResponseBody } from 'yinzerflow';
import authenticationMiddleware from './middleware/authentication.middleware';
import authenticationRoutes from './routes/authentication.routes';

// Define response types for better type safety
interface ServerResponse {
  success: boolean;
  message: string;
  timestamp?: string;
}

// Create a new YinzerFlow instance with custom error handling
export const app = new YinzerFlow({
  port: 5000,
  errorHandler: ({ response }, error): TResponseBody<ServerResponse> => {
    console.error('Server error:', error);
    response.setStatus(HttpStatusCode.INTERNAL_SERVER_ERROR as THttpStatusCode);
    return {
      success: false,
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
    };
  },
});

// Add global authentication middleware to all routes except login, register, and status
app.beforeAll(authenticationMiddleware, {
  paths: 'allButExcluded',
  excluded: ['/auth/login', '/auth/register', '/status'],
});

// Simple status endpoint to check if the server is running
app.get(
  '/status',
  (): TResponseBody<ServerResponse> => ({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  }),
);

// Group authentication routes under the /auth prefix
app.group('/auth', authenticationRoutes, {
  beforeGroup: ({ request, response }: Context): TResponseBody<ServerResponse> | void => {
    // Example of rate limiting middleware that could be implemented here
    const clientIp = request.headers['x-forwarded-for'] || 'unknown';
    console.log(`Request from IP: ${clientIp} to auth endpoint`);

    // For demonstration purposes, we're not actually implementing rate limiting
    // In a real application, you would check request frequency here

    // Uncomment to simulate rate limiting:
    // response.setStatus(HttpStatusCode.TOO_MANY_REQUESTS as THttpStatusCode);
    // return {
    //   success: false,
    //   message: 'Too many requests',
    //   timestamp: new Date().toISOString()
    // };
  },
});

// Start the server
await app.listen();

// Log server status
console.log(`Server started successfully on port ${app.options.port}`);
console.log('Server status:', app.getStatus());
