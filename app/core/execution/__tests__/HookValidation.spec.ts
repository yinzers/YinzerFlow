import { beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { HookRegistryImpl } from '@core/execution/HookRegistryImpl.ts';
import type { HandlerCallback } from '@typedefs/public/Context.js';

describe('Hook Validation', () => {
  let hookRegistry: HookRegistryImpl;

  beforeEach(() => {
    hookRegistry = new HookRegistryImpl();
  });

  const createHandler = (): HandlerCallback => () => ({ success: true });

  describe('Runtime Array Validation', () => {
    describe('beforeAll hooks', () => {
      it('should accept valid array of handlers', () => {
        const handler1 = createHandler();
        const handler2 = createHandler();

        expect(() => {
          hookRegistry._addBeforeHooks([handler1, handler2]);
        }).not.toThrow();

        expect(hookRegistry._beforeAll.size).toBe(2);
      });

      it('should throw helpful error when single function is passed instead of array', () => {
        const handler = createHandler();

        expect(() => {
          // @ts-expect-error - Testing runtime validation for JS users
          hookRegistry._addBeforeHooks(handler);
        }).toThrow(/YinzerFlow: beforeAll\(\) expects an array of handler functions, but received function\./);
      });

      it('should throw error when non-function is passed', () => {
        expect(() => {
          // @ts-expect-error - Testing runtime validation
          hookRegistry._addBeforeHooks('not a function');
        }).toThrow(
          'YinzerFlow: beforeAll() expects an array of handler functions, but received string.\n\n Expected: Array<HandlerCallback>\n Received: string',
        );
      });

      it('should throw error when array contains non-functions', () => {
        const handler = createHandler();

        expect(() => {
          // @ts-expect-error - Testing runtime validation
          hookRegistry._addBeforeHooks([handler, 'not a function', handler]);
        }).toThrow('YinzerFlow: beforeAll() array contains non-function at index 1. Expected: function, received: string');
      });

      it('should warn but not throw when empty array is passed', () => {
        const consoleSpy = spyOn(console, 'log').mockImplementation(() => {});

        expect(() => {
          hookRegistry._addBeforeHooks([]);
        }).not.toThrow();

        expect(hookRegistry._beforeAll.size).toBe(0);
        consoleSpy.mockRestore();
      });

      it('should throw error for null/undefined', () => {
        expect(() => {
          // @ts-expect-error - Testing runtime validation
          hookRegistry._addBeforeHooks(null);
        }).toThrow('YinzerFlow: beforeAll() expects an array of handler functions, but received object');

        expect(() => {
          // @ts-expect-error - Testing runtime validation
          hookRegistry._addBeforeHooks(undefined);
        }).toThrow('YinzerFlow: beforeAll() expects an array of handler functions, but received undefined');
      });
    });

    describe('afterAll hooks', () => {
      it('should accept valid array of handlers', () => {
        const handler1 = createHandler();
        const handler2 = createHandler();

        expect(() => {
          hookRegistry._addAfterHooks([handler1, handler2]);
        }).not.toThrow();

        expect(hookRegistry._afterAll.size).toBe(2);
      });

      it('should throw helpful error when single function is passed instead of array', () => {
        const handler = createHandler();

        expect(() => {
          // @ts-expect-error - Testing runtime validation for JS users
          hookRegistry._addAfterHooks(handler);
        }).toThrow(/YinzerFlow: afterAll\(\) expects an array of handler functions, but received function\./);
      });

      it('should throw error when array contains non-functions', () => {
        const handler = createHandler();

        expect(() => {
          // @ts-expect-error - Testing runtime validation
          hookRegistry._addAfterHooks([handler, 42, handler]);
        }).toThrow('YinzerFlow: afterAll() array contains non-function at index 1. Expected: function, received: number');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large arrays of handlers', () => {
      const handlers = Array.from({ length: 1000 }, () => createHandler());

      expect(() => {
        hookRegistry._addBeforeHooks(handlers);
      }).not.toThrow();

      expect(hookRegistry._beforeAll.size).toBe(1000);
    });

    it('should handle arrow functions, async functions, and regular functions', () => {
      const arrowFunction = () => ({ arrow: true });
      const asyncFunction = () => ({ async: true });
      const regularFunction = function () {
        return { regular: true };
      };

      expect(() => {
        hookRegistry._addBeforeHooks([arrowFunction, asyncFunction, regularFunction]);
      }).not.toThrow();

      expect(hookRegistry._beforeAll.size).toBe(3);
    });

    it('should validate mixed arrays correctly', () => {
      const handler = createHandler();

      expect(() => {
        // @ts-expect-error - Testing runtime validation
        hookRegistry._addBeforeHooks([handler, null, undefined, 'string', 123, {}, []]);
      }).toThrow('YinzerFlow: beforeAll() array contains non-function at index 1');
    });
  });

  describe('Error Message Quality', () => {
    it('should provide specific error messages for different types', () => {
      const testCases = [
        { input: 'string', expectedType: 'string' },
        { input: 123, expectedType: 'number' },
        { input: true, expectedType: 'boolean' },
        { input: {}, expectedType: 'object' },
        // Note: Empty arrays are handled separately and don't throw
      ];

      for (const { input, expectedType } of testCases) {
        // eslint-disable-next-line @typescript-eslint/no-loop-func
        expect(() => {
          // @ts-expect-error - Testing runtime validation
          hookRegistry._addBeforeHooks(input);
        }).toThrow(`received ${expectedType}`);
      }
    });

    it('should provide helpful guidance for function inputs', () => {
      const handler = createHandler();

      expect(() => {
        // @ts-expect-error - Testing runtime validation
        hookRegistry._addBeforeHooks(handler);
      }).toThrow(/❌ Incorrect: app\.beforeAll.*\(ctx\) => \{ \.\.\. \}/);

      expect(() => {
        // @ts-expect-error - Testing runtime validation
        hookRegistry._addBeforeHooks(handler);
      }).toThrow(/✅ Correct: app\.beforeAll.*\(.*\[.*\(ctx\) => \{ \.\.\. \}.*\].*\)/);
    });
  });
});
