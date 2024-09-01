import https from 'node:https';
import Koa from 'koa';
import sslify from 'koa-sslify';
import winston from 'winston';
import { InterceptorApi } from './applyMiddleware';

export const httpsMiddle =
  (httpsOption: any, logger: winston.Logger) =>
  (interceptor: InterceptorApi) => {
    interceptor.use((app: Koa) => {
      app.use(sslify());
      return app;
    });
    interceptor.listen((app: Koa) => {
      https.createServer(httpsOption, app.callback()).listen(8443, () => {
        logger.info(`https server is starting at port 8443`);
      });
      return app;
    });
  };
