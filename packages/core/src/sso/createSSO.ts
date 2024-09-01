import winston from 'winston';
import Koa, { type Context } from 'koa';
import Router from '@koa/router';
import type { BaseConfig } from '@wps/types-context';
import { ApplyMiddlewareResult } from './applyMiddleware';

export const createSSOWeb = ({
  config,
  logger,
  middles,
  clean,
}: {
  config: BaseConfig;
  logger: winston.Logger;
  middles: ApplyMiddlewareResult;
  before?: (app: Koa) => void;
  clean: () => Promise<any>;
}) => {
  const app = new Koa();
  middles.use(app);
  const router = middles.router(new Router());
  app.use(router.routes());
  app.listen(config.port, () => {
    logger.info(`server is starting at port ${config.port}`);
  });
  middles.listen(app);

  // 未捕获的Api异常
  app.on('request-error', (error: Error, ctx: Context) => {
    logger.error({
      type: 'request-error',
      message: error.message,
      requestId: ctx.requestId,
    });
  });

  // 未捕获的服务异常
  app.on('server-error', (error: any) => {
    logger.error({
      type: 'server-error',
      message: error.message,
    });
  });
  middles.on(app);
  // 未捕获的异常
  process.on('uncaughtException', (err) => {
    logger.debug(JSON.stringify(err.stack));
    logger.error({ msg: `未捕获的异常名称：${err.name}内容:${err.message}` });
  });

  process.on('SIGINT', () => {
    logger.info('收到SIGINT信号程开始启动清理！');
    clean()
      .then(() => {
        logger.info('清理完成！');
        process.exit();
      })
      .catch((err: any) => {
        logger.info(`清理失败！error:${err}`);
        process.exit(1);
      });
  });

  process.on('SIGTERM', () => {
    logger.info('收到SIGTERM信号程开始启动清理！');
    clean()
      .then(() => {
        logger.info('清理完成！');
        process.exit();
      })
      .catch((err: any) => {
        logger.info(`清理失败！error:${err}`);
        process.exit(1);
      });
  });
};
