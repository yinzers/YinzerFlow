import type { httpMethod } from '@constants/http.ts';
import { YinzerFlow } from '@core/YinzerFlow.ts';
import type { ServerOptions } from '@typedefs/public/Configuration.js';
import type { Context } from '@typedefs/public/Context.js';

const defaultHandler = (ctx: Context<{ response: { ctx: Context } }>) => {
  return { ctx };
};

// A counter, not a random pick: suites that hold two apps open at once (an outer beforeEach app plus a nested one)
// drew the same random port about once in a thousand and failed with EADDRINUSE. bun runs every file in one process,
// so the counter is shared by all users of this helper; 5000-9998 stays clear of the ranges other specs claim.
let _nextTestPort = 5000;

export const createTestApp = (customConfig?: ServerOptions): { app: YinzerFlow; testPort: number } => {
  const testPort = _nextTestPort++;

  const app = new YinzerFlow({ port: testPort, host: '127.0.0.1', ...customConfig });

  const httpMethods: Array<keyof typeof httpMethod> = ['get', 'post', 'put', 'delete', 'patch', 'options'];

  for (const method of httpMethods) {
    app[method]('/test', defaultHandler);
  }

  app.group('/group', (group) => {
    for (const method of httpMethods) {
      group[method]('/test', defaultHandler);
    }
  });

  return {
    app,
    testPort,
  };
};
