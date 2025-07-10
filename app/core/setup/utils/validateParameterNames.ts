/**
 * Validate that parameter names are unique within a single route
 *
 * WHY THIS MATTERS:
 * - Routes like "/users/:id/jobs/:id" are confusing and error-prone
 * - Multiple params with same name would overwrite each other: { id: "lastValue" }
 * - Forces developers to use descriptive, unique names: "/users/:userId/jobs/:jobId"
 * - Makes code self-documenting and prevents runtime bugs
 *
 * EXAMPLES OF PROBLEMS THIS PREVENTS:
 * - Bad: "/users/:id/posts/:id" → unclear which :id refers to what
 * - Good: "/users/:userId/posts/:postId" → crystal clear intent
 *
 * @example
 * ```ts
 * validateParameterNames('/users/:id/posts/:id');
 * // Throws error: "Route /users/:id/posts/:id has duplicate parameter names: id. Parameter names must be unique within a route for clarity and to prevent conflicts."
 * ```
 */
export const validateParameterNames = (routePath: string): void => {
  // Extract all parameter names from the route
  // "/users/:userId/posts/:postId" → [":userId", ":postId"] → ["userId", "postId"]
  const paramMatches = routePath.match(/:\w+/g);
  if (!paramMatches) return; // No parameters to validate

  const paramNames = paramMatches.map((param) => param.slice(1)); // Remove ':' prefix
  const uniqueParamNames = new Set(paramNames);

  // Check for duplicates
  if (paramNames.length !== uniqueParamNames.size) {
    const duplicates = paramNames.filter((name, index) => paramNames.indexOf(name) !== index);
    throw new Error(
      `Route ${routePath} has duplicate parameter names: ${duplicates.join(', ')}. ` +
        'Parameter names must be unique within a route for clarity and to prevent conflicts.',
    );
  }
};
