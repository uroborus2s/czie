import { basename } from 'node:path';
import { ErrorService } from '@wps/core';
import { type SqliteService } from '@wps/sqlite';
import type {
  ExLocalService as LocalService,
  LocalService as OrgLocalService,
  RemoteDeptBaseInfo,
  ServiceConstructor,
  DeptBaseEntity,
} from '@wps/types-context';
import dayjs from 'dayjs';
import {
  createLocalService as createOrgLocalService,
  type LocalAccountConfig,
} from '../localService';

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

  const service = createOrgLocalService(
    serviceName,
    options,
  ) as OrgLocalService;
  const init = async () => {
    await service.init();
    try {
      const sqlite = await sqliteService.getConnect(dbFile);
      logger.info(`${dbFile}准备初始化中...`);

      const createOrgsSql = `create table if not exists local_orgs
                             (
                                 org_id         TEXT NOT NULL PRIMARY KEY,
                                 org_name       TEXT,
                                 parent_unit_id TEXT,
                                 org_order      TEXT,     
                                 status         TEXT,
                                 ctime          TIMESTAMP DEFAULT (DATETIME(CURRENT_TIMESTAMP, 'localtime')),
                                 mtime          TIMESTAMP DEFAULT (DATETIME(CURRENT_TIMESTAMP, 'localtime'))
                             )`;

      const createOrgTrigger = `CREATE TRIGGER IF NOT EXISTS update_local_orgs_time
        AFTER UPDATE ON local_orgs
        FOR EACH ROW
        WHEN NEW.mtime = OLD.mtime
BEGIN
        UPDATE local_orgs SET mtime = (DATETIME(CURRENT_TIMESTAMP, 'localtime'))
        WHERE org_id = OLD.org_id;
END`;

      // 创建 用户表
      await sqlite.exec(createOrgsSql);
      await sqlite.exec(createOrgTrigger);

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

  const readChildDepts = async (id?: string) => {
    try {
      const start = dayjs().unix();
      logger.info(`从本地组织数据库查询ID${id}....`);
      const sqlite = await sqliteService.getConnect(dbFile);
      let rows;
      if (id)
        rows = await sqlite.all(
          'select * from `local_orgs` where parent_unit_id = ?',
          [id],
        );
      else rows = await sqlite.all('select * from `local_orgs`');

      const depts = rows.map((row) => ({
        deptId: row.org_id,
        deptPid: row.parent_unit_id,
        name: row.org_name,
        order: row.org_order,
        updateTime: row.mtime,
        createTime: row.ctime,
      }));
      const end = dayjs().unix();
      logger.info(
        `从本地数据库读取${depts.length}条数据，耗时${end - start}秒`,
      );
      return depts;
    } catch (e) {
      await errorService.catchLog(`${dbFile}数据库读取用户数据`, e);
      throw e;
    }
  };

  const addOrgs = async (orgs: RemoteDeptBaseInfo[]) => {
    const sqlite = await sqliteService.getConnect(dbFile);
    try {
      const start = dayjs().unix();
      await sqlite.run('BEGIN TRANSACTION');
      const createOrg = await sqlite.prepare(
        'INSERT INTO `local_orgs` (org_id,org_name,parent_unit_id,org_order,status) VALUES (?,?,?,?,?)',
      );

      await sqlite.run(`DELETE
                        FROM local_orgs`);
      for (const org of orgs) {
        try {
          await createOrg.run(
            org.deptId,
            org.name,
            org.deptPid || null,
            org.order || null,
            org.status || '1',
          );
        } catch (e) {
          console.log(e);
          await errorService.catchLog(
            `${dbFile}本地数据库插入部门ID：${org.deptId},名称:${org.name}失败！`,
            e,
          );
        }
      }
      await createOrg.finalize();
      await sqlite.run('COMMIT');
      const end = dayjs().unix();
      logger.info(`将所有组织写入本地数据库耗费时间${end - start}秒`);
    } catch (e) {
      logger.error(`Error during transaction:${JSON.stringify(e)}`);
      await sqlite.run('ROLLBACK');
    }
  };

  const addOrg = async (org: DeptBaseEntity) => {
    const sqlite = await sqliteService.getConnect(dbFile);
    try {
      const start = dayjs().unix();
      const createOrg = await sqlite.prepare(
        'INSERT INTO `local_orgs` (org_id,org_name,parent_unit_id,org_order,status) VALUES (?,?,?,?,?)',
      );

      try {
        await createOrg.run(
          org.org_id,
          org.org_name,
          org.parent_unit_id || null,
          org.org_order || null,
          org.status || '1',
        );
      } catch (e) {
        await errorService.catchLog(
          `${dbFile}本地数据库插入部门ID：${org.org_id},名称:${org.org_name}失败！`,
          e,
        );
      }
      const end = dayjs().unix();
      logger.info(`将所有组织写入本地数据库耗费时间${end - start}秒`);
    } catch (e) {
      logger.error(`Error during transaction:${JSON.stringify(e)}`);
    }
  };

  const updateOrg = async (org: DeptBaseEntity) => {
    const sqlite = await sqliteService.getConnect(dbFile);
    try {
      const start = dayjs().unix();
      const updates = [];
      const values = [];

      for (const [key, value] of Object.entries(org)) {
        if (key !== 'org_id' && value) {
          updates.push(`${key} = ?`);
          values.push(value);
        }
      }
      const query = `UPDATE local_orgs SET ${updates.join(
        ', ',
      )} WHERE org_id = ?`;
      try {
        await sqlite.run(query, ...values, org.org_id);
        logger.info(
          `${dbFile}本地数据库修改部门ID：${org.org_id}的值为${values}成功！`,
        );
      } catch (e) {
        await errorService.catchLog(
          `${dbFile}本地数据库修改部门ID：${org.org_id}失败！`,
          e,
        );
      }
      const end = dayjs().unix();
      logger.info(`将所有组织写入本地数据库耗费时间${end - start}秒`);
    } catch (e) {
      logger.error(`Error during transaction:${JSON.stringify(e)}`);
    }
  };

  const deleteOrg = async (id: string) => {
    const sqlite = await sqliteService.getConnect(dbFile);
    try {
      const start = dayjs().unix();

      const query = `DELETE FROM local_orgs WHERE org_id = ?`;
      try {
        await sqlite.run(query, id);
        logger.info(`${dbFile}本地数据库删除部门ID：${id}成功！`);
      } catch (e) {
        await errorService.catchLog(
          `${dbFile}本地数据库修改部门ID：${id}失败！`,
          e,
        );
      }
      const end = dayjs().unix();
      logger.info(`将所有组织写入本地数据库耗费时间${end - start}秒`);
    } catch (e) {
      logger.error(`Error during transaction:${JSON.stringify(e)}`);
    }
  };

  const updateSameNameOfDepts = async () => {
    const sqlite = await sqliteService.getConnect(dbFile);
    logger.info(`修改相同层级下的同名部门....`);
    try {
      const start = dayjs().unix();
      await sqlite.run(`UPDATE
                            local_orgs
                        SET org_name = org_name || '_' || CAST(org_id AS TEXT)
                        WHERE org_id IN (SELECT org_id
                                         FROM (SELECT org_id,
                                                      COUNT(org_name) OVER (PARTITION BY parent_unit_id,
                                                          org_name)   AS name_count,
                                                      ROW_NUMBER() OVER (PARTITION BY parent_unit_id,
                                                          org_name
                                                          ORDER BY
                                                              org_id) AS row_num
                                               FROM local_orgs)
                                         WHERE name_count > 1
                                           AND row_num > 1)`);

      const end = dayjs().unix();
      logger.info(`修改所有的组织信息耗时${end - start}秒`);
    } catch (e) {
      logger.error(`Error during transaction:${JSON.stringify(e)}`);
    }
  };

  const readParentDeptId = async (id: string) => {
    try {
      logger.info(`从本地组织数据库查询ID${id}....`);
      const sqlite = await sqliteService.getConnect(dbFile);
      const row = await sqlite.get(
        'SELECT child.org_id as deptId,child.org_name as name,child.org_order as org_order,parent.org_id as deptPid FROM local_orgs AS child LEFT JOIN local_orgs AS parent ON child.parent_unit_id = parent.org_id WHERE child.org_id = ?',
        [id],
      );
      return row as RemoteDeptBaseInfo;
    } catch (e) {
      await errorService.catchLog(`${dbFile}数据库读取用户数据`, e);
      throw e;
    }
  };

  const readChildUsers = async (id: string) => {
    try {
      logger.info(`从本地组织数据库查询ID${id}....`);
      const sqlite = await sqliteService.getConnect(dbFile);
      const rows = await sqlite.all(
        `SELECT u.id,
                u.name                         AS UserName,
                u.title,
                u.employeeId,
                u.phone,
                u.email,
                u.employmentType,
                GROUP_CONCAT(DISTINCT ud.d_id) AS dept_ids
         FROM local_uses_in_dept ud
                  JOIN
              local_uses u ON ud.u_id = u.id
                  join local_orgs org on org.org_id = ud.d_id
         GROUP BY u.id
         HAVING SUM(CASE WHEN ud.d_id = ? THEN 1 ELSE 0 END) > 0;`,
        [id],
      );
      return rows.map((row) => ({
        user_id: row.id,
        name: row.UserName,
        employee_id: row.id,
        dept_id: row.dept_ids.includes(',')
          ? row.dept_ids.split(',').map((element: string) => element.trim())
          : row.dept_ids.trim(),
        title: row.title,
        phone: row.phone,
        email: row.email,
        employment_type: row.employmentType,
      }));
    } catch (e) {
      await errorService.catchLog(`${dbFile}数据库读取用户数据`, e);
      throw e;
    }
  };

  return {
    ...service,
    addOrgs,
    addOrg,
    updateOrg,
    deleteOrg,
    init,
    readChildDepts,
    readChildUsers,
    updateSameNameOfDepts,
    readParentDeptId,
  };
};
