/**
 * YinzerFlow TypeScript Example
 *
 * This example demonstrates how to create a type-safe HTTP server using YinzerFlow
 * with routes, middleware, and error handling.
 */

import { HttpStatusCode, YinzerFlow } from 'yinzerflow';
import type { THttpStatusCode, TResponseBody } from 'yinzerflow';
import authenticationRoutes from './routes/authentication.routes.ts';
import setupContentHandlers from './routes/content-types.ts';

// Define response types for better type safety
interface ServerResponse {
  success: boolean;
  message: string;
  timestamp?: string;
}

// Create a new YinzerFlow instance
export const app = new YinzerFlow({
  port: 5000,
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

// Graceful shutdown example
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');

  // Give connections 5 seconds to finish before force closing
  await app.connectionManager.closeAllConnections(5000);
  await app.close();

  console.log('Server shut down gracefully');
  process.exit(0);
});
