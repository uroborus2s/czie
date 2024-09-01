import { basename, resolve } from 'node:path';
import { ErrorService } from '@wps/core';
import { type SqliteService } from '@wps/sqlite';
import type {
  LocalService,
  RemoteUserInfo,
  ServiceConstructor,
} from '@wps/types-context';
import dayjs from 'dayjs';
import { values } from 'lodash';

export interface LocalAccountConfig {
  localDbFile: string;
}

export const createLocalAccountConfig = (dir: string) => ({
  localDbFile: resolve(dir, process.env.LOCAL_ACCOUNT || ''),
});

export const createLocalService: ServiceConstructor = (
  serviceName,
  options,
): LocalService => {
  const { logger, getService } = options;
  logger.info(`创建${serviceName}对象`);
  const config = options.config as LocalAccountConfig;
  const dbFile = config.localDbFile;
  const sqliteService = getService('sqliteService') as SqliteService;
  const errorService = getService('errorService') as ErrorService;

  const init = async () => {
    try {
      const sqlite = await sqliteService.getConnect(dbFile);
      logger.info(`${dbFile}准备初始化中...`);
      const createUserSql = `create table if not exists local_uses
                             (
                                 id             TEXT NOT NULL PRIMARY KEY,
                                 wps_id         TEXT,
                                 user_order     TEXT,
                                 name           TEXT,
                                 phone          TEXT,
                                 email          TEXT,
                                 title          TEXT,
                                 employeeId     TEXT,
                                 employmentType TEXT,
                                 status         TEXT,
                                 ctime          TIMESTAMP DEFAULT (DATETIME(CURRENT_TIMESTAMP, 'localtime')),
                                 mtime          TIMESTAMP DEFAULT (DATETIME(CURRENT_TIMESTAMP, 'localtime'))
                             )`;
      const createUserTrigger = `CREATE TRIGGER IF NOT EXISTS update_local_uses_time
        AFTER UPDATE ON local_uses
        FOR EACH ROW
        WHEN NEW.mtime = OLD.mtime
BEGIN
        UPDATE local_uses SET mtime = (DATETIME(CURRENT_TIMESTAMP, 'localtime'))
        WHERE id = OLD.id;
END`;
      const createUserOfDeptSql = `create table if not exists local_uses_in_dept
                                   (
                                       id       INTEGER PRIMARY KEY AUTOINCREMENT,
                                       u_id     TEXT,
                                       wps_u_id TEXT,
                                       d_id     TEXT,
                                       wps_d_id TEXT,
                                       ctime    TIMESTAMP DEFAULT (DATETIME(CURRENT_TIMESTAMP, 'localtime')),
                                       mtime    TIMESTAMP DEFAULT (DATETIME(CURRENT_TIMESTAMP, 'localtime'))
                                   )`;
      const createUserOfDeptTrigger = `CREATE TRIGGER IF NOT EXISTS update_local_uses_in_dept_time
        AFTER UPDATE ON local_uses_in_dept
        FOR EACH ROW
        WHEN NEW.mtime = OLD.mtime
BEGIN
        UPDATE local_uses_in_dept SET mtime = (DATETIME(CURRENT_TIMESTAMP, 'localtime'))
        WHERE id = OLD.id;
END`;

      // 创建 用户表
      await sqlite.exec(createUserSql);
      await sqlite.exec(createUserTrigger);
      // 创建用户部门表
      await sqlite.exec(createUserOfDeptSql);
      await sqlite.exec(createUserOfDeptTrigger);
      await sqliteService.closeConnection(basename(dbFile, '.db'));
      logger.info(`${dbFile}初始化用户表完成，数据库已关闭！`);
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

  const readUserInfoMap = (rows: any[]) => {
    const userInfoTemps: Record<string, RemoteUserInfo> = {};
    for (const row of rows) {
      const info = userInfoTemps[row.id];
      const depts =
        row.wps_d_id || row.d_id
          ? [{ id: row.wps_d_id || '', name: '', thirdDeptId: row.d_id || '' }]
          : [];
      if (info) {
        info.depts.push(...depts);
      } else {
        userInfoTemps[row.id] = {
          userId: row.id,
          wpsUid: row.wps_id,
          name: row.name,
          depts: [...depts],
          phone: row.phone,
          email: row.email,
          title: row.title,
          order: row.user_order,
          employeeId: row.employeeId,
          employmentType: row.employmentType,
          createTime: row.ctime,
          updateTime: row.mtime,
        };
      }
    }
    return userInfoTemps;
  };

  const readAllUsers = async () => {
    try {
      const start = dayjs().unix();
      logger.info('从本地库读取数据中....');
      const sqlite = await sqliteService.getConnect(dbFile);
      const rows = await sqlite.all(
        'select local_uses.id, local_uses.wps_id, local_uses.name, local_uses.phone, local_uses.email, local_uses.title,local_uses.user_order, local_uses.employeeId,local_uses.employmentType,local_uses.mtime, local_uses.ctime,local_uses_in_dept.d_id,local_uses_in_dept.wps_d_id from `local_uses` left join `local_uses_in_dept` on local_uses_in_dept.u_id=local_uses.id',
      );
      const userInfoTemps: Record<string, RemoteUserInfo> =
        readUserInfoMap(rows);
      const userInfos: RemoteUserInfo[] = Object.keys(userInfoTemps).map(
        (id) => userInfoTemps[id],
      );
      const end = dayjs().unix();
      logger.info(
        `从本地数据库读取${userInfos.length}条数据，耗时${end - start}秒`,
      );
      return userInfos;
    } catch (e) {
      await errorService.catchLog(`${dbFile}数据库读取用户数据`, e);
      throw e;
    }
  };

  const close = () => {
    const dbName = basename(dbFile, '.db');
    return sqliteService.closeConnection(dbName);
  };

  const addUsers = async (users: RemoteUserInfo[]) => {
    const sqlite = await sqliteService.getConnect(dbFile);
    try {
      const start = dayjs().unix();
      await sqlite.run('BEGIN TRANSACTION');
      const createUser = await sqlite.prepare(
        'INSERT INTO `local_uses` (id,name,phone,email,title,user_order,employeeId,employmentType,status) VALUES (?,?,?,?,?,?,?,?,?)',
      );
      const createDept = await sqlite.prepare(
        'INSERT INTO `local_uses_in_dept` (u_id,d_id,wps_d_id) VALUES (?,?,?)',
      );
      await sqlite.run(`DELETE
                        FROM local_uses_in_dept`);
      await sqlite.run(
        `DELETE
         FROM sqlite_sequence
         WHERE name = ?`,
        'local_uses_in_dept',
      );
      await sqlite.run(`DELETE
                        FROM local_uses`);
      for (const user of users) {
        try {
          await createUser.run(
            user.userId,
            user.name,
            user.phone ?? null,
            user.email ?? null,
            user.title ?? null,
            user.order ?? null,
            user.employeeId ?? null,
            user.employmentType ?? null,
            user.status ?? '1',
          );
        } catch (e) {
          await errorService.catchLog(
            `${dbFile}数据库插入人员数据ID：${user.userId},名称:${user.name}失败！`,
            e,
          );
        }

        for (const dept of user.depts) {
          try {
            await createDept.run(user.userId, dept.thirdDeptId, dept.id);
          } catch (e) {
            await errorService.catchLog(
              `${dbFile}数据库插入部门数据ID：${user.userId},名称:${user.name},部门id:${dept.thirdDeptId},名称:${dept.name}失败！`,
              e,
            );
          }
        }
      }
      await createUser.finalize();
      await createDept.finalize();
      await sqlite.run('COMMIT');
      const end = dayjs().unix();
      logger.info(`将所有用户写入本地数据库耗费时间${end - start}秒`);
    } catch (e) {
      logger.error(`Error during transaction:${JSON.stringify(e)}`);
      await sqlite.run('ROLLBACK');
    }
  };

  const removeUsers = async (users: RemoteUserInfo[]) => {
    try {
      const sqlite = await sqliteService.getConnect(dbFile);
      const start = dayjs().unix();

      for (const user of users) {
        await sqlite.run('DELETE FROM local_uses WHERE id=?', [user.userId]);
        await sqlite.run('DELETE FROM local_uses_in_dept WHERE u_id=?', [
          user.userId,
        ]);
        const end = dayjs().unix();
        logger.info(`删除用户耗费时间${end - start}秒`);
      }
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

  const readUserByExId = async (id: string) => {
    try {
      const sqlite = await sqliteService.getConnect(dbFile);
      const rows = await sqlite.all(
        'select local_uses.id, local_uses.wps_id, local_uses.name, local_uses.phone, local_uses.email, local_uses.title,local_uses.user_order, local_uses.employeeId,local_uses.employmentType, local_uses_in_dept.d_id from `local_uses` left join `local_uses_in_dept` on local_uses_in_dept.u_id=local_uses.id where local_uses.id=?',
        [id],
      );
      const userInfoTemps: Record<string, RemoteUserInfo> =
        readUserInfoMap(rows);
      return userInfoTemps[id];
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

  const searchUserByName = async (name: string) => {
    try {
      const sqlite = await sqliteService.getConnect(dbFile);
      const rows = await sqlite.all(
        'select local_uses.id, local_uses.wps_id, local_uses.name, local_uses.phone, local_uses.email, local_uses.title,local_uses.user_order, local_uses.employeeId,local_uses.employmentType, local_uses_in_dept.d_id from `local_uses` join `local_uses_in_dept` on local_uses_in_dept.u_id=local_uses.id where local_uses.name=?',
        [name],
      );
      const userInfoTemps: Record<string, RemoteUserInfo> =
        readUserInfoMap(rows);
      return values(userInfoTemps);
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

  const createUser = async (
    user: RemoteUserInfo,
    depts: Array<{ id: string; name?: string }>,
  ) => {
    const sqlite = await sqliteService.getConnect(dbFile);
    try {
      const start = dayjs().unix();
      await sqlite.run('BEGIN TRANSACTION');
      const newUser =
        'INSERT INTO `local_uses` (id,name,phone,email,title,user_order,employeeId,employmentType,status) VALUES (?,?,?,?,?,?,?,?,?)';
      await sqlite.run(
        newUser,
        user.userId,
        user.name,
        user.phone ?? null,
        user.email ?? null,
        user.title ?? null,
        user.order ?? null,
        user.employeeId ?? null,
        user.employmentType ?? null,
        user.status ?? '1',
      );

      const createDeptStmt = `INSERT INTO local_uses_in_dept (u_id, d_id)
                              VALUES (?, ?)`;
      for (const dept of depts) {
        await sqlite.run(createDeptStmt, user.userId, dept.id);
      }

      await sqlite.run('COMMIT');
      console.log('User and departments added successfully');
      const end = dayjs().unix();
      logger.info(`将用户写入本地数据库耗费时间${end - start}秒`);
    } catch (e) {
      logger.error(`Error during transaction:${JSON.stringify(e)}`);
      await sqlite.run('ROLLBACK');
    }
  };

  const deleteUser = async (userId: string) => {
    const sqlite = await sqliteService.getConnect(dbFile);
    try {
      const start = dayjs().unix();
      await sqlite.run('BEGIN TRANSACTION');
      await sqlite.run('DELETE FROM local_uses_in_dept WHERE u_id = ?', userId);
      await sqlite.run('DELETE FROM local_uses WHERE id = ?', userId);
      await sqlite.run('COMMIT');
      const end = dayjs().unix();
      logger.info(
        `User and departments deleted successfully,time${end - start}s`,
      );
    } catch (e) {
      logger.error(`Error during transaction:${JSON.stringify(e)}`);
      await sqlite.run('ROLLBACK');
    }
  };

  const updateUser = async (
    user: RemoteUserInfo,
    depts: Array<{ id: string; name?: string }>,
  ) => {
    const sqlite = await sqliteService.getConnect(dbFile);
    try {
      // 动态更新 local_uses 表
      const fieldsToUpdate = {
        wps_id: user.wpsUid,
        user_order: user.order,
        name: user.name,
        phone: user.phone,
        email: user.email,
        title: user.title,
        employeeId: user.employeeId,
        employmentType: user.employmentType,
        status: user.status,
      } as Record<string, any>;
      // 动态构建 SET 子句
      const setClause = Object.keys(fieldsToUpdate)
        .filter((key) => fieldsToUpdate[key] !== undefined) // 过滤掉 undefined 值
        .map((key) => `${key} = ?`)
        .join(', ');

      if (setClause.length === 0) {
        resolve('没有要更新的字段');
        return;
      }
      const start = dayjs().unix();
      await sqlite.run('BEGIN TRANSACTION');
      const sql = `UPDATE local_uses SET ${setClause}, mtime = DATETIME(CURRENT_TIMESTAMP, 'localtime') WHERE id = ?`;
      const parameters = [
        ...Object.values(fieldsToUpdate).filter((value) => value !== undefined),
        user.userId,
      ];
      await sqlite.run(sql, ...parameters);

      await sqlite.run(
        'DELETE FROM local_uses_in_dept WHERE u_id = ?',
        user.userId,
      );

      const createDeptStmt = `INSERT INTO local_uses_in_dept (u_id, d_id)
                              VALUES (?, ?)`;
      for (const dept of depts) {
        await sqlite.run(createDeptStmt, user.userId, dept.id);
      }

      await sqlite.run('COMMIT');
      const end = dayjs().unix();
      logger.info(`将用户写入本地数据库耗费时间${end - start}秒`);
    } catch (e) {
      logger.error(`Error during transaction:${JSON.stringify(e)}`);
      await sqlite.run('ROLLBACK');
    }
  };

  return {
    init,
    close,
    readAllUsers,
    addUsers,
    removeUsers,
    readUserByExId,
    searchUserByName,
    createUser,
    deleteUser,
    updateUser,
  };
};
