import { type Logger } from 'winston';
import type {
  BaseConfig,
  Context,
  ContextService,
  ServiceConstructor,
} from '@wps/types-context';
import { newLogger } from './logger';
import { createRedisService } from './redisService';
import { createErrorService } from '../service/errorService';
import { createKoaAppService } from '../koa';

export default async <
  Config extends BaseConfig,
  AppContext extends Context<Config>,
>(
  name: string,
  iConfig: Config,
  serviceClasses: ServiceConstructor[],
): Promise<AppContext> => {
  let logger: Logger;
  try {
    const config = { ...iConfig };
    const logLevel = process.env.LOG_LEVEL || 'info';
    logger = newLogger(name, config.appid, logLevel);
    const classes: Record<string, ServiceConstructor> = {};
    const classesTemp = [...serviceClasses];
    classesTemp.unshift(createKoaAppService, createErrorService);
    if (config.redisUrl) {
      classesTemp.unshift(createRedisService);
    }
    classesTemp.forEach((constructor) => {
      if (typeof constructor === 'function') {
        let serviceName = constructor.name.replace(/create/g, '');
        serviceName =
          serviceName.charAt(0).toLowerCase() + serviceName.slice(1);
        classes[serviceName] = constructor;
      }
    });
    const services = {} as { [key: string]: ContextService };
    const getService = <CService extends ContextService>(
      serviceName: string,
    ) => {
      let service = services[serviceName];
      if (service) {
        return service as CService;
      }
      const constructor = classes[serviceName];
      if (constructor) {
        service = constructor(serviceName, { config, logger, getService });
        services[serviceName] = service;
        return service as CService;
      }
      return undefined;
    };

    Object.keys(classes).forEach((key: string) => {
      if (services[key] === undefined && classes[key]) {
        services[key] = classes[key](key, { logger, config, getService });
      }
    });

    let isClean = false;
    const clean = async () => {
      if (isClean) return;
      isClean = true;
      await Promise.all(
        Object.keys(services).map((key) => services[key].close()),
      );
    };

    // 未捕获的异常
    process.on('uncaughtException', (err) => {
      console.log(err);
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

    const init = async () => {
      for (const sName of Object.keys(services)) {
        await services[sName].init();
      }
    };
    await init();
    return {
      config,
      logger,
      ...services,
    } as unknown as AppContext;
  } catch (e: unknown) {
    const msg = `应用变量创建失败,失败原因${JSON.stringify(e)}`;
    console.log(msg);
    throw e;
  }
};
