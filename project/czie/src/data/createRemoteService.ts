import { buildDeptTree, RemoteService } from '@wps/core';
import type { RemoteUserInfo, ServiceConstructor } from '@wps/types-context';
import dayjs from 'dayjs';
import { type RemoveDuplicatesService } from '@wps/wpssync';
import { SqliteService } from '@wps/sqlite';
import { Config } from './createConfig';

const readOrgSql = `SELECT orgId     AS org_id,
                           'r000000' AS org_pid,
                           orgName   AS name,
                           NULL      AS px
                    FROM orgs
                    UNION ALL
                    SELECT '0' || orgId AS org_id,
                           orgId        AS org_pid,
                           '内部通讯录' AS name,
                           0            AS px
                    FROM orgs
                    UNION ALL
                    SELECT '1' || orgId AS org_id,
                           orgId        AS org_pid,
                           '家校通讯录' AS name,
                           1            AS px
                    FROM orgs
                    UNION ALL
                    SELECT deptId                AS org_id,
                           case
                               when parentId = orgId then deptGroup || orgId
                               else parentId end AS org_pid,
                           deptName              AS name,
                           sortNum               AS px
                    FROM depts`;

const readUserSql = `
    SELECT userId   as user_id,
           userName as name,
           CASE
               WHEN deptId is not null THEN deptId
               ELSE orgId
               -- 如果有其他类型的用户，不需要修改 dept
               END  AS org_id,
           userType as title,
           sortNum  as px
    FROM users`;

export const createRemoteService: ServiceConstructor = (
  serviceName: string,
  options,
): RemoteService => {
  const { logger, getService } = options;
  const rootId = 'r000000';
  const config = options.config as Config;

  const sqliteService = getService('sqliteService') as SqliteService;

  const removeDuplicatesService = getService(
    'removeDuplicatesService',
  ) as RemoveDuplicatesService;
  const init = () => Promise.resolve();

  const close = () => Promise.resolve();

  const readAllOrg = async () => {
    logger.info(`从第三方平台读取部门信息中...`);
    const start = dayjs().unix();
    const db = await sqliteService.getConnect(config.localDbFile);
    const rows = await db.all(readOrgSql);
    const node = buildDeptTree(rootId, rows, (row: any) => ({
      deptPid: row.org_pid,
      deptId: row.org_id,
      name: row.name,
      deptType: 0,
      order: row.px,
      children: [],
    }));
    const end = dayjs().unix();
    logger.info(
      `第三方部门总共${rows.length}条数据读取完成,总共耗时${end - start}秒`,
    );
    return node;
  };

  const readAllUsers = async () => {
    logger.info('从第三方读取用户信息中......');
    const start = dayjs().unix();
    const db = await sqliteService.getConnect(config.localDbFile);
    const rows = await db.all(readUserSql);

    const userInfos: RemoteUserInfo[] = rows.map((row: any) => ({
      userId: row.user_id,
      name: row.name,
      title: row.title,
      employmentType: row.title === 'teacher' ? 'teacher' : 'student',
      employeeId: row.user_id,
      order: row.px,
      depts: row.org_id ? [{ thirdDeptId: row.org_id, id: '', name: '' }] : [],
    }));
    const end = dayjs().unix();
    logger.info(
      `从第三方读取${userInfos.length}条用户数据，总共耗时${end - start}秒`,
    );

    return removeDuplicatesService.removeUserInfos(userInfos);
  };

  return { init, rootId, readAllOrg, readAllUsers, close };
};
