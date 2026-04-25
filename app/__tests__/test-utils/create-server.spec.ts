import type { httpMethod } from '@constants/http.ts';
import { YinzerFlow } from '@core/YinzerFlow.ts';
import type { ServerOptions } from '@typedefs/public/Configuration.js';
import type { Context } from '@typedefs/public/Context.js';

const defaultHandler = (ctx: Context<{ response: { ctx: Context } }>) => {
  return { ctx };
};

export const createTestApp = (customConfig?: ServerOptions): { app: YinzerFlow; testPort: number } => {
  const testPort = 5000 + Math.floor(Math.random() * 1000);

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
