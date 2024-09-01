import { ContextService, ServiceConstructor } from '@wps/types-context';
import createKoaApp, { type KoaAppOptions } from './createKoaApp';
import { type KoaConfig } from './koaAppConfig';
import { getCertificate } from '../util/crypto';
import { getMainDir } from '../util/utils';

export interface KoaAppService extends ContextService {
  createWebApp(koaAppOptions: Partial<KoaAppOptions>): Promise<void>;
}

export const createKoaAppService: ServiceConstructor = (
  serviceName,
  options,
): KoaAppService => {
  const { logger } = options;
  const config = options.config as KoaConfig;
  logger.info(`创建${serviceName}对象`);
  const init = () => Promise.resolve();

  const close = () => Promise.resolve();

  const createWebApp = async (koaAppOptions: Partial<KoaAppOptions>) => {
    const option = { ...koaAppOptions, ...config };
    const createHttpsOption = () => {
      const sslDir = getMainDir('../ssl');

      // 构造并返回结果对象
      return {
        key: getCertificate({
          dir: sslDir,
          extname: '.key',
          filePath: config.koaHttpsKeyPath,
          logger,
        }),
        cert: getCertificate({
          dir: sslDir,
          extname: ['.pem', '.crt', '.cer'],
          filePath: config.koaHttpsCertPath,
          logger,
        }),
      };
    };
    if (
      option.koaHttpsPort &&
      (option.koaHttpsOptions === undefined || option.koaHttpsOptions === null)
    ) {
      if (option.createHttpsOption) {
        option.koaHttpsOptions = {
          ...createHttpsOption(),
          ...option.createHttpsOption(),
        };
      } else {
        option.koaHttpsOptions = createHttpsOption();
      }
    }
    await createKoaApp(logger, option);
  };

  return { init, close, createWebApp };
};
