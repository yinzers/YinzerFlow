# YinzerFlow JavaScript Example

This example demonstrates how to use YinzerFlow in a JavaScript project.

## File Structure

```
javascript/
├── index.js                       # Main entry point
├── middleware/
│   └── authentication.middleware.js # Authentication middleware
└── routes/
    └── authentication.routes.js     # Authentication routes
```

## Features Demonstrated

1. **Server Setup**: Creating and configuring a YinzerFlow server
2. **Error Handling**: Custom error handler for graceful error responses
3. **Middleware**: Global authentication middleware with path exclusions
4. **Route Groups**: Grouping related routes under a common path prefix
5. **Before Group Hooks**: Executing logic before processing routes in a group

## Running the Example

```bash
# Navigate to the project root
cd /path/to/yinzerflow

# Run the example
node example/javascript/index.js
```

## Testing the API

Once the server is running, you can test the API using curl:

```bash
# Check server status
curl http://localhost:5000/status

# Login (no authentication required)
curl -X POST -H "Content-Type: application/json" \
  -d '{"username":"user","password":"pass"}' \
  http://localhost:5000/auth/login

# Access protected route (requires authentication)
curl -H "Authorization: Bearer your-token" \
  http://localhost:5000/auth/profile
```

## Code Walkthrough

### Server Setup

```javascript
// Create a new YinzerFlow instance with custom error handling
const app = new YinzerFlow({
  port: 5000,
  errorHandler: ({ response }, error) => {
    console.error('Server error: \n', error);
    response.setStatus(HttpStatusCode.INTERNAL_SERVER_ERROR);
    return { success: false, message: 'Internal server error' };
  },
});
```

### Middleware Configuration

```javascript
// Apply authentication middleware to all routes except specified ones
app.beforeAll(authenticationMiddleware, { 
  paths: 'allButExcluded', 
  excluded: ['/auth/login', '/auth/register', '/status'] 
});
```

### Route Groups

```javascript
// Group authentication-related routes under /auth
app.group('/auth', authenticationRoutes, {
  beforeGroup: ({ response }) => {
    // Logic executed before any route in this group
  },
});
``` 