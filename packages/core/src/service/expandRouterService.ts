import type { ServiceConstructor } from '@wps/types-context';
import Router from '@koa/router';
import { newService } from '../context/newService';
import type { ExpandRouterService, WpsService } from './service';

export const createExpandRouterService: ServiceConstructor = (
  serviceName,
  { logger, getService },
): ExpandRouterService => {
  const getRouter = () => {
    const router = new Router();
    const wpsService = getService('wpsService') as WpsService;

    router.get('/wps/api/exDeptId', async (ctx: any) => {
      logger.info('根据第三方id读取部门信息......');
      const { id } = ctx.query;
      const info = await wpsService.cloudOrgService.getDeptInfoByExId(id);
      ctx.status = 200;
      ctx.body = { info };
    });

    router.get('/wps/api/users', async (ctx: any) => {
      logger.info('根据wps id读取用户信息......');
      const { ids } = ctx.query;
      const users = await wpsService.cloudUserService.getUserInfos(
        ids.split(','),
      );
      ctx.status = 200;
      ctx.body = { users };
    });

    router.get('/wps/api/ex/users', async (ctx: any) => {
      logger.info('根据第三方用户id读取用户信息......');
      const { ids } = ctx.query;
      const users = await wpsService.cloudUserService.getUsersByThirdIds(
        ids.split(','),
      );
      ctx.status = 200;
      ctx.body = { users };
    });

    router.get('/wps/api/user/all', async (ctx: any) => {
      logger.info('读取所有的用户信息......');
      const { status } = ctx.query;
      let users = await wpsService.cloudUserService.getAllDimissionUsers(
        status,
      );
      users = users.filter((user) => !user.third_union_id);
      ctx.status = 200;
      ctx.body = { total: users.length, users };
    });

    return router;
  };

  return { ...newService(), getRouter };
};
