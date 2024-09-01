import type { ContextService, ServiceConstructor } from '@wps/types-context';
import { sleep, WpsService } from '@wps/core';
import dayjs from 'dayjs';

export interface CreateGroupService extends ContextService {
  createGroupByDepts(operatorId: string): (fireDate: Date) => Promise<unknown>;
}

export const createGroupService: ServiceConstructor = (
  serviceName,
  options,
): CreateGroupService => {
  const { logger, getService } = options;

  const wpsService = getService('wpsService') as WpsService;

  let isRun = false;

  const init = () => Promise.resolve();

  const close = () => Promise.resolve();

  const newGroups = async (operatorId: string, id: string) => {
    const child = await wpsService.cloudOrgService.getChildDepts(id);
    if (child.length > 0) {
      for (const c of child) {
        await sleep(20);
        const rows = (await wpsService.groupsService.readDeptGroups(c.dept_id))
          .groups;
        if (rows?.length === 0) {
          await wpsService.groupsService.createDeptGroups(
            operatorId,
            c.dept_id,
          );
          logger.info(`部门${c.name}创建部门团队成功！`);
        }
        await newGroups(operatorId, c.dept_id);
      }
    }
  };

  const createGroupByDepts = (operatorId: string) => async (fireDate: Date) => {
    logger.info(
      `${dayjs(fireDate).format('YYYY-MM-DD HH:mm:ss')}启动同步......`,
    );
    if (isRun) {
      logger.info('同步正在进行中，请稍后在执行！');
      setTimeout(
        () => createGroupByDepts(operatorId)(new Date()),
        60 * 60 * 1000,
      );
      return;
    }
    try {
      // 设置同步正在进行中
      isRun = true;
      const start = dayjs().unix();
      const rootId = await wpsService.cloudOrgService.getRootDept();
      await newGroups(operatorId, rootId);
      const end = dayjs().unix();
      logger.info(`创建部门团队，耗时${end - start}秒！`);
    } catch (e: any) {
      logger.error(`部门团队创建错误：${JSON.stringify(e)}`);
    } finally {
      close().then(() => logger.info('部门团队创建结束！'));
      // 同步结束，将标志重置
      isRun = false;
    }
  };

  return { createGroupByDepts, init, close };
};
