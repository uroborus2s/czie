import {
  createClient,
  createCluster,
  type RedisClientType,
  type RedisClusterType,
} from 'redis';
import type { BaseConfig, ContextService } from '@wps/types-context';
import { ServiceConstructor } from '@wps/types-context';

export interface RedisService extends ContextService {
  redis: RedisClientType | RedisClusterType;
}

export const createRedisService: ServiceConstructor = (
  serviceName,
  options,
): RedisService => {
  options.logger.info(`创建service name：${serviceName}`);
  const config = options.config as BaseConfig;
  const redisUrls = config.redisUrl.split(',');
  const isCluster = redisUrls.length > 1;
  let redisClient: RedisClientType | RedisClusterType;
  if (isCluster) {
    // 如果是集群模式
    const nodes = redisUrls.map((url) => ({ url }));
    redisClient = createCluster({
      rootNodes: nodes,
    });
  } else {
    redisClient = createClient({
      url: config.redisUrl,
      socket: {
        reconnectStrategy: (retries, cause) => {
          if ((cause as any).code === 'ECONNREFUSED') return false;
          return Math.min(retries * 50, 1000);
        },
      },
    });
  }
  redisClient.on('connect', () => {
    options.logger.info(`Redis Client connect at ${config.redisUrl}`);
  });
  redisClient.on('error', (err) => {
    options.logger.error('RedisService Client Error', err);
  });

  const init = async () => {
    try {
      await redisClient.connect();
      options.logger.info('RedisService start');
    } catch (e) {
      options.logger.error('RedisService start error!');
      throw e;
    }
  };

  const close = () =>
    redisClient
      .quit()
      .then(() =>
        options.logger.info('RedisService Client disconnected successfully！'),
      )
      .catch(() =>
        options.logger.error('RedisService Client disconnected error！'),
      );

  return { close, init, redis: redisClient };
};
