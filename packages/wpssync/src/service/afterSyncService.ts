import type {
  ContextService,
  ServiceConstructor,
  RemoteUserInfo,
  UpdateInfo,
} from '@wps/types-context';
import { type UserMode } from '@wps/core';
import { type DeleteUserDBInfo } from './deleteUserService';

export interface AfterSyncService extends ContextService {
  afterAddUser(users: RemoteUserInfo[]): Promise<void>;
  afterEditUsers(users: RemoteUserInfo, updateInfo: UpdateInfo): Promise<void>;
  afterTobeDeleteUsers(users: UserMode[]): Promise<void>;
  afterDeleteUsers(users: DeleteUserDBInfo[]): Promise<void>;
}

export const createAfterSyncService: ServiceConstructor = (
  serviceName,
  options,
): AfterSyncService => {
  const { logger } = options;
  logger.info(`创建${serviceName}对象`);

  const close = () => Promise.resolve();
  const init = () => Promise.resolve();
  const afterAddUser = async (users: RemoteUserInfo[]) => {};

  const afterEditUsers = async (
    user: RemoteUserInfo,
    updateInfo: UpdateInfo,
  ) => {};

  const afterTobeDeleteUsers = async (users: UserMode[]) => {};

  const afterDeleteUsers = async (users: DeleteUserDBInfo[]) => {};

  return {
    afterAddUser,
    init,
    close,
    afterEditUsers,
    afterTobeDeleteUsers,
    afterDeleteUsers,
  };
};
