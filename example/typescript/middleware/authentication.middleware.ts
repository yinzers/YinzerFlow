/**
 * Authentication Middleware
 *
 * This middleware checks for a valid authentication token in the request headers.
 * If no token is provided or the token is invalid, it returns an unauthorized response.
 */

import { HttpStatusCode } from 'yinzerflow';
import type { Context, THttpStatusCode, TResponseBody } from 'yinzerflow';

// Define user interface
interface User {
  id: string;
  name: string;
  role: string;
}

// Define response interface
interface AuthResponse {
  success: boolean;
  message: string;
  error?: string;
}

// Extend the request type to include user property
declare module 'yinzerflow' {
  interface HttpRequest {
    user?: User;
  }
}

// Simulated user database for demo purposes
const USERS: Record<string, User> = {
  'user123-token': { id: 'user123', name: 'John Doe', role: 'user' },
  'admin456-token': { id: 'admin456', name: 'Jane Smith', role: 'admin' },
};

/**
 * Authentication middleware function
 * Validates the auth token and attaches user data to the request if valid
 */
export default ({ request, response }: Context): TResponseBody<AuthResponse> | void => {
  // Get the authorization header
  const authHeader = request.headers['authorization'];

  // Check if the authorization header exists and has the correct format
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    response.setStatus(HttpStatusCode.UNAUTHORIZED as THttpStatusCode);
    return {
      success: false,
      message: 'Authentication required',
      error: 'Missing or invalid authorization header',
    };
  }

  // Extract the token
  const token = authHeader.split(' ')[1];

  // Check if the token exists in our simulated database
  const user = USERS[token];

  if (!user) {
    response.setStatus(HttpStatusCode.UNAUTHORIZED as THttpStatusCode);
    return {
      success: false,
      message: 'Authentication failed',
      error: 'Invalid token',
    };
  }

  // If we reach here, the token is valid
  // Attach the user data to the request for use in route handlers
  request.user = user;

  // Continue to the next middleware or route handler
  // By not returning anything, we allow the request to proceed
};
