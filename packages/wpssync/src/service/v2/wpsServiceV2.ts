import type { RemoteUserInfo, ServiceConstructor } from '@wps/types-context';
import {
  ErrorService,
  sleep,
  verifyEmail,
  verifyEmployeeId,
  verifyPhone,
  WpsService,
} from '@wps/core';
import { createWpsService as createWpsServiceV1 } from '../wpsService';
import { type AfterSyncService } from '../afterSyncService';

export const createWpsService: ServiceConstructor = (
  serviceName,
  options,
): WpsService => {
  const wpsService = createWpsServiceV1(serviceName, options) as WpsService;
  const { logger, getService } = options;

  const errorService = getService('errorService') as ErrorService;

  const afterSyncService = getService('afterSyncService') as AfterSyncService;

  const addUser = async (user: RemoteUserInfo) => {
    let mainDeptId;
    if (user.depts && user.depts.length > 0 && user.depts[0].id) {
      mainDeptId = user.depts[0].id;
    } else mainDeptId = await wpsService.cloudOrgService.getRootDept();
    const createUserInfo = {
      name: user.name,
      thirdUnionId: user.userId,
      deptId: mainDeptId!,
      phone: verifyPhone(user.phone || undefined),
      email: verifyEmail(user.email || undefined),
      title: user.title || undefined,
      employeeId: verifyEmployeeId(user.employeeId || undefined),
      employmentType: user.employmentType,
    };
    const addNewUser = async (createInfo: any) => {
      let userId: string = '';
      try {
        userId = await wpsService.cloudUserService.createNewUser_V2(createInfo);
      } catch (e: any) {if (e && e.response && e.response.data) {
          logger.warn(
            `创建用户${user.name}-${e.response.data.msg || e.message}`,
          );
          if ([10401038, 10401007, 10401006].includes(e.response.data.result)) {
            if (e.response.data.result === 10401006) delete createInfo.phone;
            else if (
              e.response.data.result === 10401038 ||
              e.response.data.result === 10401007
            )
              delete createInfo.email;
            userId = await addNewUser(createInfo);
          } else {
            logger.error(
              `axios error:${JSON.stringify(
                e.response.data,
              )},data:${JSON.stringify(e.config.data)}`,
            );
          }
        } else throw e;
      }
      return userId;
    };
    const addUserId = await addNewUser(
      JSON.parse(JSON.stringify(createUserInfo)),
    );
    return addUserId;
  };

  const addUsers = async (users: RemoteUserInfo[]) => {
    let total = 0;
    for (const user of users) {
      const mainDeptId = await wpsService.cloudOrgService.getRootDept();
      try {
        await sleep(50);
        const userId = await addUser(user);

        await wpsService.syncDepartmentOfUser(user, {
          company_uid: userId as string,
          depts: [{ id: mainDeptId, name: '' }] as {
            id: string;
            name: string;
          }[],
          name: user.name as string,
          role_id: 3,
          status: 'active',
        });

        total += 1;
        logger.info(`${user.name}创建成功！`);
      } catch (e) {
        await errorService.catchLog(`${user.name}创建用户失败`, e);
      }
    }
    await afterSyncService.afterAddUser(users);
    logger.info(`${total}个用户创建成功！总共用户${users.length}`);
  };

  return { ...wpsService, addUsers, addUser };
};
