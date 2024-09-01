import {
  ContextService,
  RemoteUserInfo,
  ServiceConstructor,
} from '@wps/types-context';
import { sleep, UserMode, WpsService } from '@wps/core';
import dayjs from 'dayjs';

export interface PrefixSyncToWpsUserService extends ContextService {
  updateWpsUserExId(
    noExIdUsers: UserMode[],
    localUsers: RemoteUserInfo[],
  ): Promise<unknown>;
}

export const createPrefixSyncToWpsUserService: ServiceConstructor = (
  serviceName,
  { logger, getService },
) => {
  const close = () => Promise.resolve();
  const init = () => Promise.resolve();
  const wpsService = getService('wpsService') as WpsService;

  const updateWpsUserExId = async (
    noExIdUsers: UserMode[],
    localUsers: RemoteUserInfo[],
  ) => {
    try {
      const start = dayjs().unix();
      for (let i = 0; i < noExIdUsers.length; i += 1) {
        await sleep(20);
        const indexes: RemoteUserInfo[] = [];
        localUsers.forEach((localUser) => {
          if (localUser.name === noExIdUsers[i].name) {
            indexes.push(localUser);
          }
        });
        if (indexes.length === 1) {
          if (noExIdUsers[i].status === 'active') {
            logger.info(
              `自定义导入的用户的第三方${noExIdUsers[i].name}绑定为中`,
            );
            await wpsService.cloudUserService.thirdBindUnionId(
              noExIdUsers[i].company_uid,
              indexes[0].userId,
            );
            logger.info(
              `绑定用户的${noExIdUsers[i].name}第三方id为${indexes[0].userId}`,
            );
          } else if (indexes.length > 1) {
            logger.info(JSON.stringify(indexes));
          } else {
            logger.info(
              `自定义导入的用户的第三方${noExIdUsers[i].name}未激活，删除中.....`,
            );
            await wpsService.cloudUserService.deleteUser(
              noExIdUsers[i].company_uid,
            );
            logger.info(`${noExIdUsers[i].name}删除成功！`);
          }
        }
      }
      const end = dayjs().unix();
      logger.info(`绑定用户的第三方id耗时${end - start}秒`);
    } catch (e) {
      if (e instanceof Error) {
        logger.debug(e.stack);
      } else {
        logger.info(JSON.stringify(e));
      }
      throw e;
    }
  };

  return { updateWpsUserExId, init, close };
};
