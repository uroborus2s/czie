import { basename, resolve } from 'node:path';
import { ErrorService } from '@wps/core';
import { type SqliteService } from '@wps/sqlite';
import type { LocalDeptService, RemoteDeptInfo } from '@wps/types-context';
import { ServiceConstructor } from '@wps/types-context';
import dayjs from 'dayjs';

export interface LocalDeptConfig {
  localDeptDbFile: string;
}

export const createLocalDeptConfig = (dir: string) => ({
  localDeptDbFile: resolve(dir, process.env.LOCAL_DEPTS || ''),
});

export const createLocalDeptService: ServiceConstructor = (
  serviceName,
  options,
): LocalDeptService => {
  const { logger, getService } = options;
  logger.info(`创建${serviceName}对象`);
  const config = options.config as LocalDeptConfig;
  const dbFile = config.localDeptDbFile;
  const sqliteService = getService('sqliteService') as SqliteService;
  const errorService = getService('errorService') as ErrorService;

  const init = async () => {
    try {
      const sqlite = await sqliteService.getConnect(dbFile);
      logger.info(`${dbFile}准备初始化中...`);
      const createDeptSql = `create table if not exists local_depts
(
    dept_id       TEXT NOT NULL PRIMARY KEY,
    wps_dept_id       TEXT,
    name TEXT,
    dept_pid TEXT,
    wps_dept_pid TEXT,
    status       TEXT,
    ctime TIMESTAMP DEFAULT (DATETIME(CURRENT_TIMESTAMP,'localtime')),
    mtime TIMESTAMP DEFAULT (DATETIME(CURRENT_TIMESTAMP,'localtime'))
)`;
      const createDeptsTrigger = `CREATE TRIGGER IF NOT EXISTS update_local_depts_time
        AFTER UPDATE ON local_depts
        FOR EACH ROW
        WHEN NEW.mtime = OLD.mtime
BEGIN
        UPDATE local_depts SET mtime = (DATETIME(CURRENT_TIMESTAMP, 'localtime'))
        WHERE dept_id = OLD.dept_id;
END`;

      // 创建 部门对应表
      await sqlite.exec(createDeptSql);
      await sqlite.exec(createDeptsTrigger);
      logger.info(`${dbFile}初始化部门表完成，数据库已关闭！`);
    } catch (e) {
      await errorService.catchLog(`${dbFile}初始化部门表失败！`, e);
    }
  };

  const initFromWps = async (rootNode: RemoteDeptInfo) => {
    try {
      const start = dayjs().unix();
      logger.info('从wps云中获取部门信息同步本地....');
      const sqlite = await sqliteService.getConnect(dbFile);
      const rows = await sqlite.all('SELECT * FROM `local_depts`');
      if (rows.length > 0) return;
      const writeDept = async (childs: RemoteDeptInfo[]) => {
        for (let i = 0; i < childs.length; i += 1) {
          await sqlite.run(
            'INSERT INTO `local_depts` (dept_id,dept_pid,name,wps_dept_id,wps_dept_pid) VALUES (?,?,?,?,?)',
            [
              childs[i].deptId,
              childs[i].deptPid,
              childs[i].name,
              childs[i].wpsDeptId,
              childs[i].wpsDeptPid,
            ],
          );
          await writeDept(childs[i].children);
        }
      };
      await writeDept(rootNode.children);
      const end = dayjs().unix();
      logger.info(`从wps云文档中读取初始化到部门库${end - start}秒`);
    } catch (e) {
      await errorService.catchLog(`${dbFile}数据库读取用户数据`, e);
    }
  };

  const close = () => {
    const dbName = basename(dbFile, '.db');
    return sqliteService.closeConnection(dbName);
  };

  const addDept = async (dept: Omit<RemoteDeptInfo, 'children'>) => {
    try {
      const sqlite = await sqliteService.getConnect(dbFile);
      await sqlite.run(
        'INSERT INTO `local_depts` (dept_id,dept_pid,name,wps_dept_id,wps_dept_pid) VALUES (?,?,?,?,?)',
        [dept.deptId, dept.deptPid, dept.name, dept.wpsDeptId, dept.wpsDeptPid],
      );
      logger.info(`新增部门${dept.name}到本地数据库${dbFile}成功！`);
    } catch (e) {
      await errorService.catchLog(
        `新增部门${dept.name}到本地数据库${dbFile}失败`,
        e,
      );
    }
  };

  const deleteDept = async (deptId: string) => {
    try {
      const sqlite = await sqliteService.getConnect(dbFile);
      await sqlite.run('DELETE FROM local_depts WHERE dept_id=?', [deptId]);
      logger.info(`从本地数据库中删除部门${deptId}成功！`);
    } catch (e) {
      await errorService.catchLog(`从数据库${dbFile}中删除部门${deptId}`, e);
    }
  };

  const readWpsDeptId = async (dId: string) => {
    try {
      const sqlite = await sqliteService.getConnect(dbFile);
      const row = await sqlite.get(
        'SELECT * FROM local_depts WHERE dept_id=?',
        [dId],
      );
      return row?.wps_dept_id;
    } catch (e) {
      await errorService.catchLog(
        `根据第三方部门id${dId}获取云文档部门id失败！`,
        e,
      );
      throw e;
    }
  };

  return {
    init,
    close,
    addDept,
    deleteDept,
    initFromWps,
    readWpsDeptId,
  };
};
