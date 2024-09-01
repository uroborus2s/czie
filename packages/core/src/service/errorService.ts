import { ServiceConstructor } from '@wps/types-context';
import { newService } from '../context/newService';
import type { ErrorService, WpsService } from './service';

export const createErrorService: ServiceConstructor = (
  serviceName,
  { logger, getService },
): ErrorService => {
  const catchLog = async (msg: string, error: any) => {
    const wpsService = getService('wpsService') as WpsService;
    if (error.response) {
      logger.error(`${msg}--url:${error.response.config.url}`);
      const { result } = error.response.data;
      if (result) {
        logger.error(`${msg}--result:${error.response.data.result}`);
        logger.error(`${msg}--msg:${error.response.data.msg}`);
        if (result === '10102025') {
          await wpsService.tokenService.getToken();
        }
      }
    } else if (error instanceof Error || (error.message && error.stack)) {
      if (process.env.NODE_ENV !== 'production') logger.error(error.stack);
      logger.error(`${msg}--${error.message}`);
      throw error;
    } else {
      throw error;
    }
  };

  return { ...newService(), catchLog };
};
