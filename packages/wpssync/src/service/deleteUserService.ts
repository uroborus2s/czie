import { basename } from 'node:path';
import type { ContextService, RemoteUserInfo } from '@wps/types-context';
import { ServiceConstructor } from '@wps/types-context';
import type { SqliteService } from '@wps/sqlite';
import {
  ErrorService,
  timestampUnix,
  type UserMode,
  type WpsService,
} from '@wps/core';
import dayjs from 'dayjs';
import type { LocalAccountConfig } from './localService';
import type { DeletionVerifyService } from './deletionVerifyService';
import { AfterSyncService } from './afterSyncService';

export interface DeleteUserDBInfo {
  id: string;
  wid: string;
  name: string;
  type: number;
  delete_time: number;
}

export interface DeleteUserService extends ContextService {
  readAllDeleteUsers(): Promise<DeleteUserDBInfo[]>;
  readDeleteUserById(id: string): Promise<DeleteUserDBInfo | undefined>;
  deleteUsers(): Promise<void>;
  addToBeDeleteUsers(users: UserMode[]): Promise<void>;
  deleteUserFromTobeDelete(userInfos: RemoteUserInfo[]): Promise<void>;
}

export const createDeleteUserService: ServiceConstructor = (
  serviceName: string,
  options,
): DeleteUserService => {
  const { logger, getService } = options;
  const config = options.config as LocalAccountConfig;
  logger.info(`创建${serviceName}对象`);
  const dbFile = config.localDbFile;
  const sqliteService = getService('sqliteService') as SqliteService;
  const wpsService = getService('wpsService') as WpsService;
  const deletionVerifyService = getService(
    'deletionVerifyService',
  ) as DeletionVerifyService;
  const errorService = getService('errorService') as ErrorService;
  const afterSyncService = getService('afterSyncService') as AfterSyncService;

  const init = async () => {
    try {
      const sqlite = await sqliteService.getConnect(dbFile);
      logger.info(`${dbFile}-用户删除表准备初始化中...`);
      const createTobeDeletedUser = `create table if not exists tobe_user_delete
(
    id       TEXT NOT NULL PRIMARY KEY,
    wid       TEXT,
    name TEXT,
--     教师：0；本科生：1；研究生：2；
    type INTEGER,
    delete_time INTEGER NOT NULL,
    ctime TIMESTAMP DEFAULT (DATETIME(CURRENT_TIMESTAMP,'localtime'))
)`;
      const createDeletedUser = `create table if not exists deleted_user
(
    id       TEXT NOT NULL PRIMARY KEY,
    name TEXT,
    wid       TEXT,
    --     教师：0；本科生：1；研究生：2；
    type INTEGER,
    ctime TIMESTAMP DEFAULT (DATETIME(CURRENT_TIMESTAMP,'localtime'))
)`;
      // 创建待删除用户表
      await sqlite.exec(createTobeDeletedUser);
      // 创建已经删除的用户
      await sqlite.exec(createDeletedUser);
      await sqliteService.closeConnection(basename(dbFile, '.db'));
      logger.info(`${dbFile}初始化用户删除表完成，数据库已关闭！`);
    } catch (e) {
      if (e instanceof Error) {
        logger.debug(e.stack);
        logger.info(`${dbFile}数据库初始化失败！失败原因：${e.message}`);
      } else {
        logger.info(JSON.stringify(e));
      }
      throw e;
    }
  };

  const close = () => Promise.resolve();

  const deleteUserFromDb = async (row: DeleteUserDBInfo) => {
    try {
      const sqlite = await sqliteService.getConnect(dbFile);
      await sqlite.run('DELETE FROM `tobe_user_delete` WHERE id=?', [row.id]);
      await sqlite.run('DELETE FROM `local_uses_in_dept` WHERE u_id=?', [
        row.id,
      ]);
      await sqlite.run(
        'INSERT INTO `deleted_user` (id,wid,name,type) VALUES (?,?,?,?)',
        [row.id, row.wid, row.name, row.type],
      );
    } catch (e) {
      if (e instanceof Error) {
        logger.debug(e.stack);
        logger.info(`${dbFile}数据库初始化失败！失败原因：${e.message}`);
      } else {
        logger.info(JSON.stringify(e));
      }
      throw e;
    }
  };

  const addToBeDeleteUsers = async (users: UserMode[]) => {
    const sqlite = await sqliteService.getConnect(dbFile);
    const start = dayjs().unix();
    for (const user of users) {
      try {
        await wpsService.cloudUserService.updateUser(user.company_uid, {
          title: '待删除',
        });
        await sqlite.run(
          'INSERT INTO `tobe_user_delete` (id,wid,name,type,delete_time) VALUES (?,?,?,?,?)',
          [
            user.third_union_id,
            user.company_uid,
            user.name,
            user.employee_id,
            timestampUnix(),
          ],
        );
      } catch (e) {
        await errorService.catchLog(`${user.name}创建用户失败`, e);
      }
    }
    await afterSyncService.afterTobeDeleteUsers(users);
    const end = dayjs().unix();
    logger.info(`删除用户耗费时间${end - start}s`);
  };

  const readAllDeleteUsers = async () => {
    const sqlite = await sqliteService.getConnect(dbFile);
    const rows = await sqlite.all('select * from `tobe_user_delete`');
    return rows as DeleteUserDBInfo[];
  };

  const readDeleteUserById = async (
    id: string,
  ): Promise<undefined | DeleteUserDBInfo> => {
    const sqlite = await sqliteService.getConnect(dbFile);
    const row = await sqlite.get(
      'select * from `tobe_user_delete` where id=?',
      [id],
    );
    return row;
  };

  const deleteUsers = async () => {
    logger.info('*******开始从待删除区删除人员********');
    const start = dayjs().unix();
    let total = 0;
    const rows = await readAllDeleteUsers();
    for (const row of rows) {
      const toDelete = deletionVerifyService.verify(row);
      if (toDelete) {
        logger.info(
          `准备删除人员id:${row.id},姓名：${row.name},进入待删除区时间${dayjs
            .unix(row.delete_time)
            .format('YYYY-MM-DD HH:mm:ss')}`,
        );
        await wpsService.deleteUser(row.wid);
        await deleteUserFromDb(row);
        await afterSyncService.afterDeleteUsers([row]);
        total += 1;
      }
    }
    const end = dayjs().unix();
    logger.info(`总共删除人员${total}个，耗时${end - start}秒！`);
  };

  const deleteUserFromTobeDelete = async (userInfos: RemoteUserInfo[]) => {
    try {
      const sqlite = await sqliteService.getConnect(dbFile);
      for (const user of userInfos) {
        await sqlite.run('DELETE FROM `tobe_user_delete` WHERE id=?', [
          user.userId,
        ]);
        logger.info(`用户${user.name}从待删除区恢复正常！`);
      }
      logger.info(`用户完全恢复成功！`);
    } catch (e) {
      if (e instanceof Error) {
        logger.debug(e.stack);
        logger.info(`${dbFile}数据库初始化失败！失败原因：${e.message}`);
      } else {
        logger.info(JSON.stringify(e));
      }
      throw e;
    }
  };

  return {
    readAllDeleteUsers,
    init,
    close,
    deleteUsers,
    addToBeDeleteUsers,
    deleteUserFromTobeDelete,
    readDeleteUserById,
  };
};
