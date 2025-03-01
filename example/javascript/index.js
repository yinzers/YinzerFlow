/**
 * YinzerFlow JavaScript Example
 *
 * This example demonstrates how to create a production-ready HTTP server using YinzerFlow
 * with routes, middleware, error handling, and logging.
 *
 * Features demonstrated:
 * - Server configuration and initialization
 * - Global middleware application
 * - Route grouping
 * - Custom error handling
 * - Health check endpoint
 * - Graceful shutdown
 */

import { YinzerFlow, HttpStatusCode } from 'yinzerflow';
import authenticationMiddleware from './middleware/authentication.middleware.js';
import authenticationRoutes from './routes/authentication.routes.js';

// Create a new YinzerFlow instance with custom error handling
export const app = new YinzerFlow({
  port: process.env.PORT || 5000,
  host: process.env.HOST || '0.0.0.0',
  errorHandler: ({ request, response }, error) => {
    // Log the error with request details for debugging
    console.error(`[ERROR] ${request.method} ${request.path}:`, error);

    // Set appropriate status based on error type
    if (error.name === 'ValidationError') {
      response.setStatus(HttpStatusCode.BAD_REQUEST);
      return {
        success: false,
        message: 'Validation failed',
        errors: error.details || error.message,
        requestId: request.id,
      };
    }

    // Default server error response
    response.setStatus(HttpStatusCode.INTERNAL_SERVER_ERROR);
    return {
      success: false,
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
      requestId: request.id,
    };
  },
  logger: (message) => {
    console.log(`[YinzerFlow] ${new Date().toISOString()} - ${message}`);
  },
});

// Request ID middleware - adds a unique ID to each request for tracking
app.beforeAll(({ request }, next) => {
  request.id = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`[REQUEST] ${request.method} ${request.path} - ID: ${request.id}`);
  return next();
});

// Add global authentication middleware to all routes except login, register, and status
app.beforeAll(authenticationMiddleware, {
  paths: 'allButExcluded',
  excluded: ['/auth/login', '/auth/register', '/status', '/health'],
});

// Simple health check endpoint for monitoring
app.get('/health', () => ({
  status: 'healthy',
  uptime: process.uptime(),
  timestamp: new Date().toISOString(),
}));

// Status endpoint with more detailed information
app.get('/status', () => ({
  success: true,
  message: 'Server is running',
  version: '1.0.0',
  environment: process.env.NODE_ENV || 'development',
  timestamp: new Date().toISOString(),
  memory: process.memoryUsage(),
}));

// Group authentication routes under the /auth prefix
app.group('/auth', authenticationRoutes, {
  beforeGroup: ({ request, response }) => {
    // Example of rate limiting middleware
    const clientIp = request.headers['x-forwarded-for'] || request.ip || 'unknown';
    console.log(`[AUTH] Request from IP: ${clientIp} to auth endpoint`);

    // For demonstration purposes, we're not actually implementing rate limiting
    // In a real application, you would check request frequency here

    // Example of how you might implement rate limiting:
    /*
    const MAX_REQUESTS = 10;
    const WINDOW_MS = 60000; // 1 minute
    
    const key = `rate-limit:${clientIp}`;
    const currentRequests = getRateLimit(key); // Get from Redis/memory store
    
    if (currentRequests > MAX_REQUESTS) {
      response.setStatus(HttpStatusCode.TOO_MANY_REQUESTS);
      response.addHeaders([{ 'Retry-After': '60' }]);
      return { 
        success: false, 
        message: 'Too many requests, please try again later',
        retryAfter: 60
      };
    }
    
    incrementRateLimit(key, WINDOW_MS); // Update in Redis/memory store
    */
  },
});

// Setup graceful shutdown
const shutdown = async (signal) => {
  console.log(`\n[SERVER] Received ${signal}, shutting down gracefully...`);
  try {
    await app.close();
    console.log('[SERVER] All connections closed successfully');
    process.exit(0);
  } catch (error) {
    console.error('[SERVER] Error during shutdown:', error);
    process.exit(1);
  }
};

// Listen for termination signals
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Start the server
try {
  await app.listen();
  console.log(`[SERVER] Started successfully on ${app.options.host}:${app.options.port}`);
  console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('[SERVER] Status:', app.getStatus());
} catch (error) {
  console.error('[SERVER] Failed to start:', error);
  process.exit(1);
}
