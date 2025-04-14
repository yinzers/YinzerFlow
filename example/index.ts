/**
 * YinzerFlow TypeScript Example
 *
 * This example demonstrates how to create a type-safe HTTP server using YinzerFlow
 * with routes, middleware, and error handling.
 */

import authenticationRoutes from './routes/authentication.routes.ts';
import setupContentHandlers from './routes/content-types.ts';
import { HttpStatusCode, YinzerFlow } from 'yinzerflow';
import type { THttpStatusCode, TResponseBody } from 'yinzerflow';

// Define response types for better type safety
interface ServerResponse {
  success: boolean;
  message: string;
  timestamp?: string;
}

// Create a new YinzerFlow instance
export const app = new YinzerFlow({
  port: 5000,
  connectionOptions: {
    socketTimeout: 10000,
    gracefulShutdownTimeout: 5000,
  },
  parserOptions: {
    yaml: {
      raw: true,
    },
    json: {
      raw: true,
    },
  },
  errorHandler: ({ response }, error): TResponseBody<ServerResponse> => {
    console.error('Server error:', error);
    response.setStatus(HttpStatusCode.INTERNAL_SERVER_ERROR as THttpStatusCode);
    return {
      success: false,
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
    };
  },
});

// Setup routes
app.get('/status', () => ({ success: true, message: 'Server is running' }));

// Setup content type handlers
setupContentHandlers(app);

// Setup authentication routes
app.group('/auth', authenticationRoutes);

// Start the server
await app.listen();
const { port, isListening } = app.getStatus();

if (isListening) console.log(`Server running on http://localhost:${port}`);


