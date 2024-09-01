import { basename, resolve } from 'node:path';
import type { ContextService, ServiceConstructor } from '@wps/types-context';
import { SqliteService } from '@wps/sqlite';
import { WpsService } from '@wps/core';
import dayjs from 'dayjs';

export interface LocalOrgConfig {
  localOrgDbFile: string;
}

export const createLocalOrgConfig = (dir: string) => ({
  localOrgDbFile: resolve(dir, process.env.LOCALDB_URL || ''),
});

export interface WriteExIdService extends ContextService {
  updateWpsExId(): Promise<unknown>;
}

export const createWriteExIdService: ServiceConstructor = (
  serviceName,
  options,
): WriteExIdService => {
  const { logger, getService } = options;
  const config = options.config as LocalOrgConfig;

  const dbFile = config.localOrgDbFile;

  const sqliteService = getService('sqliteService') as SqliteService;
  const wpsService = getService('wpsService') as WpsService;

  const close = () => {
    const dbName = basename(dbFile, '.db');
    return sqliteService.closeConnection(dbName);
  };
  const init = () => Promise.resolve();

  const updateWpsExId = async () => {
    try {
      const sqlite = await sqliteService.getConnect(dbFile);
      const rows = await sqlite.all('select * from `SYNC_DEPT_TO_WPS`');
      const start = dayjs().unix();
      for (const row of rows) {
        const wpsId = row.wps_dept_id;
        const exDeptId = row.dept_id as string;
        if (exDeptId.indexOf('-') < 0) {
          const info = await wpsService.cloudOrgService.getDeptInfo(wpsId);
          if (info && !info.ex_dept_id) {
            await wpsService.cloudOrgService.updateDepts(wpsId, {
              exDeptId: row.dept_id,
            });
          } else if (info === undefined) {
            console.log(row);
          }
        }
      }
      const end = dayjs().unix();
      logger.info(`重写第三方id耗时${end - start}秒`);
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

  return { updateWpsExId, init, close };
};
