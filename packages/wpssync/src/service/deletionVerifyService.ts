import type { ContextService } from '@wps/types-context';
import { ServiceConstructor } from '@wps/types-context';
import { expiredTimestamp, timestampUnix } from '@wps/core';
import type { DeleteUserDBInfo } from './deleteUserService';

export interface DeletionVerifyService extends ContextService {
  verify(row: DeleteUserDBInfo): boolean;
}

export const createDeletionVerifyService: ServiceConstructor = (
  serviceName,
  { logger },
): DeletionVerifyService => {
  logger.info(`创建${serviceName}对象`);

  const init = () => Promise.resolve();

  const close = () => Promise.resolve();

  const verify = (row: DeleteUserDBInfo) => {
    const now = timestampUnix();
    const expired = expiredTimestamp(row.delete_time, 6);
    return expired < now;
  };

  return { init, close, verify };
};
