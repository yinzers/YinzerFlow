# YinzerJS Documentation

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
   - [Using npm](#using-npm)
   - [Using Bun](#using-bun)
   - [Using Yarn](#using-yarn)
   - [Using pnpm](#using-pnpm)
3. [Getting Started](#getting-started)
   - [Importing YinzerFlow](#importing-yinzerflow)
   - [Creating an Application Instance](#creating-an-application-instance)
   - [Defining Routes](#defining-routes)
4. [Route Groups](#route-groups)
5. [Response Handling](#response-handling)
6. [Middleware](#middleware)
   - [Global Middleware](#global-middleware)
   - [Route-specific Middleware](#route-specific-middleware)
7. [Starting the Server](#starting-the-server)
8. [Request Handling Flow](#request-handling-flow)
9. [Error Handling](#error-handling)
10. [Examples](#examples)
11. [Contribution](#contribution)
12. [Conclusion](#conclusion)

## Overview

YinzerFlow is a lightweight HTTP server framework built for Node.js, designed with TypeScript in mind. It leverages TypeScript's powerful type system to provide enhanced type safety and autocompletion, making it easier for developers to build robust web applications. With YinzerFlow, you can enjoy a flexible routing system, middleware support, and a straightforward interface to handle incoming requests and responses—all while benefiting from TypeScript's clear typing and error-checking capabilities. This combination allows for a smoother development experience, reducing runtime errors and improving code maintainability.

```typescript
import { YinzerFlow } from 'yinzerflow';

export const app = new YinzerFlow({
  port: 5000,
});

app.post('/example-route', (ctx) => {
  const { body } = ctx.request;
  return { message: 'Hello, world!' };
});

app.listen();
```

## Installation

To get started with YinzerFlow, simply install it using your preferred package manager. YinzerFlow is available via npm, as well as other popular package managers such as Bun, Yarn, and pnpm. Follow the instructions below based on the package manager you are using:

### Using npm

If you are using npm, run the following command in your terminal:

```bash
npm install yinzerflow
```

### Using Bun

For those who prefer Bun, you can add YinzerFlow to your project with the following command:

```bash
bun add yinzerflow
```

### Using Yarn

If you're a Yarn user, you can easily install YinzerFlow by running:

```bash
yarn add yinzerflow
```

### Using pnpm

For developers who utilize pnpm, you can install YinzerFlow with:

```bash
pnpm add yinzerflow
```

## Getting Started

### Importing YinzerFlow

```typescript
import { YinzerFlow } from 'yinzerflow';
```

### Creating an Application Instance

```typescript
const app = new YinzerFlow({ port: 5000 });
```

### Defining Routes

You can define routes using the `route` method. Each route can have a path, a handler, and optional before and after handlers.

```typescript
app.get(
  '/example',
  ({ request, response }) => {
    return { message: 'Hello, world!' };
  },
  {
    beforeHandler: ({ request, response }) => {
      // Logic before the main handler
    },
    afterHandler: ({ request, response }) => {
      // Logic after the main handler
    },
  },
);
```

**Before handler uses:**
The before handler is a good place to perform operations such as authentication, validation, or any pre-processing logic before the main handler is executed.

**After handler uses:**
The after handler can be used for post-processing tasks like logging, modifying the response, or cleaning up resources after the main handler has completed.

### Additional Route Methods and Parameters

YinzerFlow supports various HTTP methods such as `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, and `OPTIONS`. You can use these methods to define routes for specific HTTP requests.

```typescript
app.get('/example-route', ({ request, response }) => {
  // Route handler logic
});
app.patch('/example-route', ({ request, response }) => {
  // Route handler logic
});
app.post('/example-route', ({ request, response }) => {
  // Route handler logic
});
app.delete('/example-route', ({ request, response }) => {
  // Route handler logic
});
```

You can also specify route parameters using the `:param` syntax:

```typescript
app.get('/users/:id', ({ request }) => {
  const { params } = request;
  const { id } = params;
  // Route handler logic
});
```

You can also access query parameters from the request:

```typescript
app.get('/search?location=pittsburgh', ({ request, response }) => {
  const { query } = request;
  const { location } = query;
  // Route handler logic
});
```

## Route Groups

You can group routes using the `group` method. This is useful for applying middleware to multiple routes at once or for organizing related routes.

```typescript
app.group('/api', () => {
  app.get('/users', ({ request, response }) => {
    // Route handler logic
  });
  app.post('/users', ({ request, response }) => {
    // Route handler logic
  });
});
```

If needed, you can also apply before handlers to the entire group. This logic will run after the global middleware but before the individual route before handlers

```typescript
app.group(
  '/api',
  {
    beforeHandler: ({ request, response }) => {
      // Logic before the group
    },
  },
  () => {
    app.get('/users', ({ request, response }) => {
      // Route handler logic
    });
  },
);
```

## Response Handling

The route handlers, before handlers, and middleware functions can return a response in the form of an object or a string. The headers and status code can be set using the `response` object as well. The return headers and status code will be assumed if they are not specified.

```typescript
app.get('/example-route', () => {
  return {
    success: true,
    message: 'Hello, world!',
  };
});
```

In this example, the response status is set to `200`, and the response body is an object meaning the response headers will be set to `application/json` by default.

```typescript
app.post('/example-route', ({ response }) => {
  response.setStatus(201);
  return 'Hello, world!';
});
```

For more strict control over the response, you can use the `TResponseBody` type parameter to specify the response body type:

```typescript
app.get('/example-route', (): TResponseBody<{ success: boolean; message: string }> => {
  return {
    success: true,
    message: 'Hello, world!',
  };
});
```

In this example, the response status is set to `201`, and the response body is a string. The response headers are set to `text/plain` by default in this case.

### Changing or Adding Headers

You can also add or remove headers using the `response` object:

```typescript
app.get('/example-route', ({ response }) => {
  response.addHeaders(['Content-Type: application/json']);
  response.removeHeaders(['X-Auth-Token']);
  return { success: true, message: 'Hello, world!' };
});
```

## Route Validation (Coming Soon)

You can validate routes using the `validate` method. This method takes a schema object and validates the request body, query parameters, or route parameters against it.

```typescript
app.post(
  '/example-route',
  ({ request }) => {
    const { body } = request;
    const { name, age } = body;
    // Route handler logic
  },
  {
    validate: {
      body: {
        email: { type: 'email', required: true },
        name: { type: 'string', required: true },
        dateOfBirth: { type: 'date' },
        age: { type: 'number', min: 18 },
      },
    },
  },
);
```

## Middleware

YinzerFlow supports middleware that can be applied globally or to specific routes. Middleware can manipulate the request and also return a response. This is useful for tasks such as authentication and throttling.

### Global Middleware

To apply middleware before all routes:

```typescript
app.beforeAll(({ request, response }) => {
  // middleware logic
});
```

To apply middleware to specific routes:

```typescript
app.beforeAll(
  ({ request, response }) => {
    // middleware logic
  },
  {
    paths: ['/user/:id'],
    excluded: [],
  },
);
```

To apply middleware to all routes except specific ones:

```typescript
app.beforeAll(
  ({ request, response }) => {
    // middleware logic
  },
  {
    paths: 'allButExcluded',
    excluded: ['/login', '/register'],
  },
);
```

### Route-specific Middleware

To apply middleware to specific routes:

```typescript
app.use({ paths: ['/route1', '/route2'] }, (ctx) => {
  // Middleware logic
});
```

## Starting the Server

To start the server, call the `listen` method:

```typescript
app.listen();
```

## Request Handling Flow

The request handling process follows this sequence:

1. Incoming request
2. Route validation
3. Global middleware
4. Before group middleware
5. Before route middleware
6. Route handler
7. After route middleware
8. Response sent

## Error Handling

### Why Use Built-in Error Handling?

1. **Enhanced User Experience**: Custom error handlers provide meaningful and consistent error messages to users.
2. **Simplified Debugging**: Built-in logging capabilities make identifying and fixing errors easier.
3. **Improved Reliability**: Effectively catching and managing errors prevents unexpected crashes, ensuring smoother operation.

### How to Set Up a Custom Error Handler

Set up a custom error handler by defining it in the `errorHandler` method when creating a new instance of YinzerFlow.

#### Example Usage

```typescript
const app = new YinzerFlow({
  port: 5000,
  errorHandler: ({ response }, error): TResponseBody<unknown> => {
    console.error('Server error: \n', error);
    response.setStatus(<THttpStatusCode>HttpStatusCode.TOO_MANY_REQUESTS);
    return { success: false, message: 'Internal server error' };
  },
});
```

## Examples

Refer to the examples folder in the YinzerFlow repository for more detailed usage examples.

## Contribution

Guidelines coming soon. For now, feel free to open an issue or submit a pull request.

## Conclusion

YinzerFlow provides a straightforward way to build HTTP servers in Node.js, with support for routing and middleware. For more advanced features, consider extending the framework or integrating with other libraries.
