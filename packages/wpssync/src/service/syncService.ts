import type {
  ContextService,
  IgnoreService,
  LocalDeptService,
  LocalService,
  RemoteDeptInfo,
  RemoteUserInfo,
  ServiceConstructor,
} from '@wps/types-context';
import {
  asyncPool,
  diffOfArray,
  ErrorService,
  RemoteService,
  sleep,
  WpsService,
} from '@wps/core';
import dayjs from 'dayjs';
import { type DeleteUserService } from './deleteUserService';
import { type PrefixSyncToWpsUserService } from './prefixSyncToWpsUserService';

export interface SyncService extends ContextService {
  syncUserFromRemote(): Promise<void>;

  sync(fireDate: Date): Promise<void>;

  syncUserToWps(): Promise<void>;

  syncDept(): Promise<void>;

  deleteEmptyDepts(fireDate: Date): Promise<void>;

  syncUserAndDeptsV1(): Promise<void>;

  syncTask(
    fireDate: Date,
    taskName: string,
    task: () => Promise<void>,
  ): Promise<void>;

  syncUserGroupTask(fireDate: Date, task: () => Promise<void>): Promise<void>;

  neatEmptyDept(): Promise<void>;
}

export interface NoAddUserToWpsConfig {
  noAdd: boolean;
  noAddDept: boolean;
}

export const createNoAddUserToWpsConfig = () => ({
  noAdd: process.env.WPS_NO_ADD_USER === 'TRUE',
  noAddDept: process.env.WPS_NO_ADD_DEPT === 'TRUE',
});

export const createSyncService: ServiceConstructor = (
  serviceName: string,
  options,
): SyncService => {
  const { logger, getService } = options;
  logger.info(`创建${serviceName}对象`);
  const config = options.config as NoAddUserToWpsConfig;

  let syncing = false;
  const remoteService = getService('remoteService') as RemoteService;
  const localService = getService('localService') as LocalService;
  const localDeptsService = getService('localDeptService') as LocalDeptService;

  const wpsService = getService('wpsService') as WpsService;
  const deleteUserService = getService(
    'deleteUserService',
  ) as DeleteUserService;

  const errorService = getService('errorService') as ErrorService;

  const init = () => Promise.resolve();

  const close = () =>
    Promise.all([localService.close(), localDeptsService.close()]);

  const prefixSyncToWpsUserService = getService(
    'prefixSyncToWpsUserService',
  ) as PrefixSyncToWpsUserService;

  const deleteDepts = async (id: string) => {
    const child = await wpsService.cloudOrgService.getChildDepts(id);
    if (child.length > 0) {
      for (const c of child) {
        await sleep(20);
        await deleteDepts(c.dept_id);
      }
    } else {
      await sleep(20);
      const users = await wpsService.cloudOrgService.getAllUsersInDept(id);
      if (users.length === 0) {
        logger.info(`删除部门${id}`);
        await wpsService.cloudOrgService.deleteAllDepts(id);
        logger.info(`删除空部门${id}成功！`);
      }
    }
  };

  const deleteEmptyDepts = async (fireDate: Date) => {
    logger.info(
      `${dayjs(fireDate).format('YYYY-MM-DD HH:mm:ss')}启动清空部门......`,
    );
    if (syncing) {
      logger.info('清空部门正在进行中，请稍后在执行！');
      return;
    }
    try {
      // 设置同步正在进行中
      syncing = true;
      const start = dayjs().unix();
      const rootId = await wpsService.cloudOrgService.getRootDept();
      await deleteDepts(rootId);
      const end = dayjs().unix();
      logger.info(`清除空部门，耗时${end - start}秒！`);
    } catch (e) {
      await errorService.catchLog('清除空部门失败', e);
    } finally {
      // 同步结束，将标志重置
      syncing = false;
    }
  };

  const syncUserToWps = async () => {
    logger.info('*******开始将本地用户同步到wps云文档********');
    const start = dayjs().unix();
    let localUsers = await localService.readAllUsers();
    let wpsUsers = await wpsService.readAllUsers();

    const toBeDeleteUsers = await deleteUserService.readAllDeleteUsers();
    if (prefixSyncToWpsUserService) {
      const noExIdUsers = wpsUsers.filter((wUser) => !wUser.third_union_id);
      await prefixSyncToWpsUserService.updateWpsUserExId(
        noExIdUsers,
        localUsers,
      );
    }
    wpsUsers = wpsUsers
      .filter((user) => !!user.third_union_id)
      .filter(
        (user) =>
          toBeDeleteUsers.findIndex(
            (deleteUser) => deleteUser.id === user.third_union_id,
          ) < 0,
      );

    const ignoreService = getService('ignoreService') as IgnoreService;
    if (ignoreService) {
      logger.info('去除例外！');
      const iginores = await ignoreService.ignores();
      wpsUsers = wpsUsers.filter(
        (user) =>
          iginores.findIndex((iginore) => iginore.id === user.third_union_id) <
          0,
      );

      localUsers = localUsers.filter(
        (user) =>
          iginores.findIndex((iginore) => iginore.id === user.userId) < 0,
      );
    }

    const { dele, add, edit } = diffOfArray(
      wpsUsers,
      localUsers,
      (wpsUser, localUser: RemoteUserInfo) =>
        wpsUser.third_union_id === localUser.userId,
    );
    if (add && add.length > 0) {
      logger.info(`将${add.length}个新增的用户新增到用户`);
      const addToWps: RemoteUserInfo[] = [];
      const deleteFromDB: RemoteUserInfo[] = [];
      for (let i = 0; i < add.length; i += 1) {
        const res = toBeDeleteUsers.findIndex(
          (deleteUser) => deleteUser.id === add[i].userId,
        );
        if (res < 0) {
          addToWps.push(add[i]);
        } else {
          deleteFromDB.push(add[i]);
        }
      }
      if (!config.noAdd) {
        await wpsService.addUsers(addToWps);
      }
      await deleteUserService.deleteUserFromTobeDelete(deleteFromDB);
    }
    if (dele && dele.length > 0) {
      logger.info(`将${dele.length}个用户添加到待删除区`);
      const nowDele = dele.filter((value) => value.status !== 'active');
      for (const delUser of nowDele) {
        await wpsService.deleteUser(delUser.company_uid);
      }
      const delayDele = dele.filter((value) => value.status === 'active');
      await deleteUserService.addToBeDeleteUsers(delayDele);
    }
    if (edit && edit.length > 0) {
      logger.info(`将修改${edit.length}个用户`);
      await wpsService.editUsers(edit, wpsUsers);
    }
    const end = dayjs().unix();
    logger.info(`将本地数据库数据同步到wps文档耗费时间${end - start}秒`);
  };

  const syncUserFromRemote = async () => {
    logger.info('*******开始从第三方用户库中同步用户********');
    const start = dayjs().unix();
    if (remoteService === undefined)
      throw new Error('无法找到remoteService服务');

    const remoteUserInfos = await remoteService.readAllUsers();

    if (remoteUserInfos.length > 0) {
      logger.info(`将${remoteUserInfos.length}个用户添加到本地数据库`);
      await localService.addUsers(remoteUserInfos);
    }
    const end = dayjs().unix();
    logger.info(`从第三方同步用户到本地数据库耗费时间${end - start}秒`);
  };

  const syncInternal = async (
    orgNode: RemoteDeptInfo,
    wpsRootNode: RemoteDeptInfo,
  ) => {
    const { children } = orgNode;
    const { children: localChildren } = wpsRootNode;
    // 将本地部门保存在临时temp中，当处理完同步数据后，剩余的节点则是需要删除的部门
    const restDepts: (RemoteDeptInfo | null)[] = [...localChildren];
    await asyncPool(
      1,
      children.map((rDept, index) => async () => {
        logger.info(`正在同步部门${rDept.name}`);
        const realIndex = (localChildren as RemoteDeptInfo[]).findIndex(
          (lDept) => rDept.deptId === lDept.deptId,
        );
        if (realIndex !== -1) {
          if (!localChildren[realIndex]) {
            logger.info(
              `本地部门名称${rDept.name},id：${rDept.deptId}，无法找到信息`,
            );
            return;
          }
          const oldName = localChildren[realIndex].name;
          const oldOrder = Number(localChildren[realIndex].order || 0);
          //  找到有相同的部门信息
          if (oldName !== rDept.name || oldOrder !== rDept.order) {
            //  部门名称修改
            await wpsService.editDept(orgNode, localChildren[realIndex], rDept);
          }

          //  继续进行子部门的处理
          await syncInternal(rDept, localChildren[realIndex]);
          // 删除已经处理的节点
          restDepts[realIndex] = null;
        } else {
          const seq = typeof rDept.order === 'number' ? rDept.order : index;
          if (!config.noAddDept)
            //  没有相同的部门，部门为新增
            await wpsService.addDept(orgNode, rDept, seq);
        }
      }),
    );
    //  临时数组还存在的字节则是需要删除的节点。删除节点
    await asyncPool(
      1,
      restDepts
        .filter(
          (restDept) =>
            restDept !== null && restDept.deptType === 0 && restDept.deptId,
        )
        .map((dept) => async () => {
          await wpsService.deleteDept(dept!);
        }),
    );
  };

  const syncDept = async () => {
    const start = dayjs().unix();
    // 读取源部门
    const orgNode = await remoteService.readAllOrg!();
    //   读取wps云文档上的全量部门数据
    const wpsRootNode = await wpsService.readAllDepts();
    if (wpsRootNode.children.length > 0)
      await localDeptsService.initFromWps(wpsRootNode);
    if (orgNode) await syncInternal(orgNode, wpsRootNode);
    const end = dayjs().unix();
    logger.info('同步部门成功！');
    logger.info(`同步部门耗费时间${end - start}s`);
  };

  const syncTask = async (
    fireDate: Date,
    taskName: string,
    task: () => Promise<void>,
  ) => {
    logger.info(
      `${dayjs(fireDate).format(
        'YYYY-MM-DD HH:mm:ss',
      )}任务${taskName}启动......`,
    );
    if (syncing) {
      logger.info(`${taskName}任务正在进行中，请稍后在执行！`);
      return;
    }
    try {
      // 设置同步正在进行中
      syncing = true;
      await task();
    } catch (e: any) {
      await errorService.catchLog('同步错误', e);
      setTimeout(() => syncTask(new Date(), taskName, task), 5 * 60 * 1000);
    } finally {
      close().then(() => logger.info('同步结束！'));
      // 同步结束，将标志重置
      syncing = false;
    }
  };

  let groupSyncing = false;
  const syncUserGroupTask = async (
    fireDate: Date,
    task: () => Promise<void>,
  ) => {
    logger.info(
      `${dayjs(fireDate).format(
        'YYYY-MM-DD HH:mm:ss',
      )}同步用户组任务启动......`,
    );
    if (groupSyncing) {
      logger.info(`用户组同步任务正在进行中，请稍后在执行！`);
      return;
    }
    try {
      // 设置同步正在进行中
      groupSyncing = true;
      await task();
    } catch (e: any) {
      await errorService.catchLog('用户组激活任务错误', e);
    } finally {
      close().then(() => logger.info('用户组激活任务结束！'));
      // 同步结束，将标志重置
      groupSyncing = false;
    }
  };

  const neatEmptyDept = async () => {
    await sleep(60 * 5 * 1000);
    let users = await wpsService.readAllUsers();
    users = users.filter((u) => u.depts.length === 0 && !u.third_union_id);
    const rootId = await wpsService.cloudOrgService.getRootDept();
    for (const user of users) {
      await wpsService.cloudUserService.addUserToDept(user.company_uid, rootId);
      logger.info(`将用户${user.name}加入到根目录中${rootId}`);
    }
  };

  const syncUserAndDeptsV1 = async () => {
    await syncDept();
    // 万达项目，通过buildEnterpriseData函数读取所有的用户信息并存储到本地数据中
    if (!config.noAddDept) await syncUserFromRemote();
    await syncUserToWps();
    await deleteUserService.deleteUsers();
    await neatEmptyDept();
  };

  const sync = (fireDate: Date) =>
    syncTask(fireDate, '部门和用户同步任务', syncUserAndDeptsV1);

  return {
    sync,
    syncUserFromRemote,
    init,
    close,
    syncUserToWps,
    syncDept,
    deleteEmptyDepts,
    syncTask,
    syncUserAndDeptsV1,
    neatEmptyDept,
    syncUserGroupTask,
  };
};
