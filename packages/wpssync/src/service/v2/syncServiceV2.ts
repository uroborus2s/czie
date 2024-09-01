import type {
  ExLocalService as LocalService,
  ServiceConstructor,
} from '@wps/types-context';
import type { RemoteService, WpsService } from '@wps/core';
import dayjs from 'dayjs';
import {
  createSyncService as createBaseSyncService,
  type SyncService as BaseSyncService,
} from '../syncService';

export interface SyncService extends BaseSyncService {
  syncDeptFromRemoteToLocal(): Promise<void>;

  syncEmployeeIdDelayed(fireDate: Date): Promise<void>;
}

export const createSyncService: ServiceConstructor = (
  serviceName: string,
  options,
): SyncService => {
  const { logger, getService } = options;
  logger.info(`创建${serviceName}对象`);
  const syncService = createBaseSyncService(
    serviceName,
    options,
  ) as BaseSyncService;

  const remoteService = getService('remoteService') as RemoteService;
  const localService = getService('localService') as LocalService;

  const wpsService = getService('wpsService') as WpsService;

  const syncDeptFromRemoteToLocal = async () => {
    const start = dayjs().unix();
    // 读取源部门
    const remoteDeptInfos = await remoteService.readAllOrgArray!();

    if (remoteDeptInfos.length > 0) {
      logger.info(`将${remoteDeptInfos.length}个部门添加到本地数据库`);
      await localService.addOrgs(remoteDeptInfos);
    }
    await localService.updateSameNameOfDepts();
    const end = dayjs().unix();
    logger.info(`从第三方同步部门到本地数据库耗费时间${end - start}秒`);
  };

  const syncEmployeeIdDelayed = async () => {
    logger.info('*******开始绑定用户的employee id********');
    let total = 0;
    const start = dayjs().unix();
    const users = await wpsService.readAllUsers();
    for (const user of users) {
      if (!user.employee_id && user.third_union_id) {
        total += 1;
        await wpsService.cloudUserService.updateUser(user.company_uid, {
          employeeId: user.third_union_id,
        });
        logger.info(`将用户的${user.name}绑定学号${user.third_union_id}`);
      }
    }
    const end = dayjs().unix();
    logger.info(`绑定${total}条用户数据耗费时间${end - start}秒`);
  };

  return {
    ...syncService,
    syncDeptFromRemoteToLocal,
    syncEmployeeIdDelayed,
  };
};
