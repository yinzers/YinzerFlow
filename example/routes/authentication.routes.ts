/**
 * Authentication Routes
 *
 * This file defines routes for user authentication including:
 * - User registration
 * - User login
 * - User logout
 * - User profile retrieval
 */

import { HttpStatusCode } from 'yinzerflow';
import type { Context,  IRoute,  THttpStatusCode, TResponseBody } from 'yinzerflow';

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

// Mock database for demonstration
const users: User[] = [
  {
    id: '1',
    email: 'user@example.com',
    password: 'password123', // In a real app, this would be hashed
    name: 'Example User',
  },
];

// Mock tokens for demonstration
const tokens: Record<string, string> = {};

/**
 * Authentication routes
 */
export default <IRoute[]>[
  // Register a new user
  {
    path: '/register',
    method: 'POST',
    handler: ({ request, response }: Context): TResponseBody<AuthResponse> => {
      const { email, password, name } = request.body as {
        email?: string;
        password?: string;
        name?: string;
      };

      // Validate input
      const errors: Record<string, string | null> = {
        email: !email ? 'Email is required' : null,
        password: !password ? 'Password is required' : null,
        name: !name ? 'Name is required' : null,
      };

      // Check if any errors exist
      const hasErrors = Object.values(errors).some((error) => error !== null);
      if (hasErrors) {
        response.setStatus(HttpStatusCode.BAD_REQUEST as THttpStatusCode);
        return {
          success: false,
          message: 'Validation failed',
          errors: Object.fromEntries(Object.entries(errors).filter(([_, value]) => value !== null)),
        } as TResponseBody<AuthResponse>;
      }

      // Check if user already exists
      const existingUser = users.find((u) => u.email === email);
      if (existingUser) {
        response.setStatus(HttpStatusCode.BAD_REQUEST as THttpStatusCode);
        return {
          success: false,
          message: 'User already exists',
          error: 'Email already in use',
        } as TResponseBody<AuthResponse>;
      }

      // Create new user
      const newUser: User = {
        id: (users.length + 1).toString(),
        email: email!,
        password: password!, // In a real app, this would be hashed
        name: name!,
      };

      users.push(newUser);

      // Generate token
      const token = `token_${Date.now()}_${newUser.id}`;
      tokens[newUser.id] = token;

      response.setStatus(HttpStatusCode.CREATED as THttpStatusCode);
      return {
        success: true,
        message: 'User registered successfully',
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
        },
        token,
      } as TResponseBody<AuthResponse>;
    },
  },

  // Login user
  {
    path: '/login',
    method: 'POST',
    handler: ({ request, response }: Context): TResponseBody<AuthResponse> => {
      const { email, password } = request.body as {
        email?: string;
        password?: string;
      };

      // Validate input
      if (!email || !password) {
        response.setStatus(HttpStatusCode.BAD_REQUEST as THttpStatusCode);
        return {
          success: false,
          message: 'Email and password are required',
        } as TResponseBody<AuthResponse>;
      }

      // Find user
      const user = users.find((u) => u.email === email && u.password === password);
      if (!user) {
        response.setStatus(HttpStatusCode.UNAUTHORIZED as THttpStatusCode);
        return {
          success: false,
          message: 'Invalid credentials',
        } as TResponseBody<AuthResponse>;
      }

      // Generate token
      const token = `token_${Date.now()}_${user.id}`;
      tokens[user.id] = token;

      return {
        success: true,
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        token,
      } as TResponseBody<AuthResponse>;
    },
  },

  // Get user profile
  {
    path: '/profile/:id',
    method: 'GET',
    handler: ({ request, response  }: Context): TResponseBody<AuthResponse> => {
      const { id } = <{ id: string }>request.params;
      const authHeader = request.headers.Authorization;

      // Check if user exists
      const user = users.find((u) => u.id === id);
      if (!user) {
        response.setStatus(HttpStatusCode.NOT_FOUND as THttpStatusCode);
        return {
          success: false,
          message: 'User not found',
        } as TResponseBody<AuthResponse>;
      }

      // Validate token
      const expectedToken = tokens[id];
      if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== expectedToken) {
        response.setStatus(HttpStatusCode.UNAUTHORIZED as THttpStatusCode);
        return {
          success: false,
          message: 'Unauthorized',
        } as TResponseBody<AuthResponse>;
      }

      return {
        success: true,
        message: 'Profile retrieved successfully',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      } as TResponseBody<AuthResponse>;
    },
  },

  // Logout user
  {
    path: '/logout',
    method: 'POST',
    handler: ({ request, response }: Context): TResponseBody<AuthResponse> => {
      const authHeader = request.headers.Authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        response.setStatus(HttpStatusCode.BAD_REQUEST as THttpStatusCode);
        return {
          success: false,
          message: 'No token provided',
        } as TResponseBody<AuthResponse>;
      }

      const token = authHeader.split(' ')[1];
      const userId = Object.keys(tokens).find((id) => tokens[id] === token);

      if (!userId) {
        response.setStatus(HttpStatusCode.UNAUTHORIZED as THttpStatusCode);
        return {
          success: false,
          message: 'Invalid token',
        } as TResponseBody<AuthResponse>;
      }

      // Remove token
      delete tokens[userId];

      return {
        success: true,
        message: 'Logout successful',
      } as TResponseBody<AuthResponse>;
    },
  },
];
