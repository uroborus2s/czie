import Koa from 'koa';
import Router from '@koa/router';
import koaBody from 'koa-body';
import koaLogger from 'koa-logger';
import dayjs from 'dayjs';
import { compose } from './compose';

const useMiddle = (interceptor: InterceptorApi) => {
  interceptor.use((app: Koa) => {
    app.use(
      koaLogger((str) =>
        console.log(`${dayjs().format('YYYY-MM-DD HH:mm:ss')} ${str}`),
      ),
    );
    app.use(koaBody());
    return app;
  });
};

export type InterceptorApi = Record<InterceptorType, CallbackFunction>;

export type middlewareFun = (api: InterceptorApi) => void;

export type InterceptorType = 'use' | 'on' | 'router' | 'listen';
export type CallbackFunction = (...args: any[]) => any;

export interface ApplyMiddlewareResult {
  use: (app: Koa) => Koa;
  listen: (app: Koa) => Koa;
  on: (app: Koa) => Koa;
  router: (router: Router) => Router;
}

export const applyMiddleware = (
  ...middlewares: middlewareFun[]
): ApplyMiddlewareResult => {
  const callbacks: Record<InterceptorType, CallbackFunction[]> = {
    use: [],
    listen: [],
    on: [],
    router: [],
  };

  const interceptor = {} as InterceptorApi;
  Object.keys(callbacks).forEach((key) => {
    interceptor[key as InterceptorType] = (callback: CallbackFunction) =>
      callbacks[key as InterceptorType].push(callback);
  });

  middlewares.unshift(useMiddle);
  middlewares.forEach((middleware) => middleware(interceptor));

  const result = {} as ApplyMiddlewareResult;
  Object.entries(callbacks).forEach(([key, func]) => {
    result[key as InterceptorType] = compose(...func);
  });

  return result;
};
