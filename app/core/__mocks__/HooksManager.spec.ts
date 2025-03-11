import { mock } from 'bun:test';

/**
 * Creates a mock HooksManager instance with mocked methods using Bun's built-in mocking
 *
 * @returns Object containing the mock and reset function
 */
export const createMockHooksManager = (): {
  mock: Record<string, any>;
  reset: () => void;
} => {
  // Create mock functions using Bun's mock
  const processBeforeAll = mock(async () => Promise.resolve(undefined));
  const processBeforeGroup = mock(async () => Promise.resolve(undefined));
  const processBeforeHandler = mock(async () => Promise.resolve(undefined));
  const processAfterHandler = mock(async () => Promise.resolve(undefined));
  const add = mock(() => mockHooksManager);
  const clear = mock(() => mockHooksManager);
  const on = mock(() => {});
  const emit = mock(() => {});

  // Reset function
  const resetMocks = (): void => {
    processBeforeAll.mockClear();
    processBeforeGroup.mockClear();
    processBeforeHandler.mockClear();
    processAfterHandler.mockClear();
    add.mockClear();
    clear.mockClear();
    on.mockClear();
    emit.mockClear();
  };

  // Create the mock object
  const mockHooksManager = {
    processBeforeAll,
    processBeforeGroup,
    processBeforeHandler,
    processAfterHandler,
    add,
    clear,
    on,
    emit,
    hooksCount: 0,
  };

  return {
    mock: mockHooksManager,
    reset: resetMocks,
  };
};
