/**
 * Authentication Routes
 *
 * This file defines routes for user authentication including:
 * - User registration
 * - User login
 * - User logout
 * - User profile retrieval
 */

import { HttpStatusCode, YinzerFlow } from 'yinzerflow';
import type { Context, THttpStatusCode, TResponseBody } from 'yinzerflow';

const app = new YinzerFlow();

// Define interfaces for better type safety
interface User {
  id: string;
  email: string;
  password: string;
  name: string;
}

interface UserResponse {
  id: string;
  email: string;
  name: string;
}

interface AuthResponse {
  success: boolean;
  message: string;
  user?: UserResponse;
  token?: string;
  error?: string;
  errors?: Record<string, string | null>;
}

// Simulated user database for demo purposes
const users: User[] = [{ id: 'user123', email: 'john@example.com', password: 'password123', name: 'John Doe' }];

// Simulated token storage
const tokens: Record<string, string> = {};

export default [
  // User registration endpoint
  app.post(
    '/register',
    ({ request, response }: Context): TResponseBody<AuthResponse> => {
      const { email, password, name } = request.body as { email?: string; password?: string; name?: string };

      // Create a new user
      const id = `user-${Date.now()}`;
      const newUser: User = { id, email: email!, password: password!, name: name! };

      // In a real app, you would hash the password before storing it
      users.push(newUser);

      // Return success response
      response.setStatus(HttpStatusCode.CREATED as THttpStatusCode);
      return {
        success: true,
        message: 'User registered successfully',
        user: { id, email: email!, name: name! }, // Don't return the password
      };
    },
    {
      beforeHandler: ({ request, response }: Context): TResponseBody<AuthResponse> | void => {
        const { email, password, name } = request.body as { email?: string; password?: string; name?: string };

        // Validate required fields
        if (!email || !password || !name) {
          response.setStatus(HttpStatusCode.BAD_REQUEST as THttpStatusCode);
          return {
            success: false,
            message: 'Invalid request',
            errors: {
              email: !email ? 'Email is required' : null,
              password: !password ? 'Password is required' : null,
              name: !name ? 'Name is required' : null,
            },
          };
        }

        // Check if user already exists
        const existingUser = users.find((user) => user.email === email);
        if (existingUser) {
          response.setStatus(HttpStatusCode.CONFLICT as THttpStatusCode);
          return {
            success: false,
            message: 'User already exists',
            error: 'A user with this email already exists',
          };
        }

        // If validation passes, continue to the handler
      },
    },
  ),

  // User login endpoint
  app.post('/login', ({ request, response }: Context): TResponseBody<AuthResponse> => {
    const { email, password } = request.body as { email?: string; password?: string };

    // Validate required fields
    if (!email || !password) {
      response.setStatus(HttpStatusCode.BAD_REQUEST as THttpStatusCode);
      return {
        success: false,
        message: 'Invalid request',
        error: 'Email and password are required',
      };
    }

    // Find user by email
    const user = users.find((user) => user.email === email);

    // Check if user exists and password matches
    if (!user || user.password !== password) {
      response.setStatus(HttpStatusCode.UNAUTHORIZED as THttpStatusCode);
      return {
        success: false,
        message: 'Login failed',
        error: 'Invalid email or password',
      };
    }

    // Generate a token (in a real app, use JWT or similar)
    const token = `${user.id}-token`;
    tokens[user.id] = token;

    // Return success with token
    return {
      success: true,
      message: 'Login successful',
      user: { id: user.id, email: user.email, name: user.name },
      token,
    };
  }),

  // User logout endpoint
  app.post('/logout', ({ request, response }: Context): TResponseBody<AuthResponse> => {
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      response.setStatus(HttpStatusCode.BAD_REQUEST as THttpStatusCode);
      return {
        success: false,
        message: 'Invalid request',
        error: 'No authentication token provided',
      };
    }

    const token = authHeader.split(' ')[1];

    // In a real app, you would invalidate the token
    // For this example, we'll just acknowledge the logout

    return {
      success: true,
      message: 'Logout successful',
    };
  }),

  // Get current user profile (protected route)
  app.get('/profile', ({ request, response }: Context): TResponseBody<AuthResponse> => {
    // The user object is attached by the authentication middleware
    const user = request.user;

    if (!user) {
      response.setStatus(HttpStatusCode.UNAUTHORIZED as THttpStatusCode);
      return {
        success: false,
        message: 'Authentication required',
      };
    }

    return {
      success: true,
      message: 'Profile retrieved',
      user: { id: user.id, name: user.name, email: user.email || '' },
    };
  }),
];
