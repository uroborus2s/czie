import axios from 'axios';
import type { BaseConfig, ServiceConstructor } from '@wps/types-context';
import {
  KSOSign_V1,
  sleep,
  TokenServiceV7,
  UserGroupService,
  UserMode,
  type WpsService as WpsServiceBase,
} from '@wps/core';
import { createWpsService as createWpsServiceV2 } from '../v2/wpsServiceV2';

export interface WpsService extends WpsServiceBase {
  addUsersToGroup: () => Promise<void>;
  tokenServiceV7: TokenServiceV7;
  userGroupService: UserGroupService;
  addUserToGroupByV1: (
    companyId: string,
    companyUser: UserMode,
  ) => Promise<void>;
}

export const createWpsService: ServiceConstructor = (
  serviceName,
  options,
): WpsService => {
  const wpsService = createWpsServiceV2(serviceName, options) as WpsService;

  const { logger } = options;
  const config = options.config as BaseConfig;
  logger.info(`创建${serviceName}对象`);

  const wpsHttpClientV7 = axios.create({
    baseURL: config.wpsCloudUrl,
    ...config.axios,
  });

  wpsHttpClientV7.interceptors.request.use(
    (req) => KSOSign_V1(req, config.appid, config.appkey),
    (error) => Promise.reject(error),
  );

  const tokenServiceV7 = new TokenServiceV7(
    config.appid,
    config.appkey,
    wpsHttpClientV7,
  );
  const userGroupService = new UserGroupService(
    tokenServiceV7,
    wpsHttpClientV7,
  );

  // 添加函数注释
  const addUserToGroupByV1 = async (
    companyId: string,
    companyUser: UserMode,
  ) => {
    // 根据用户信息获取组信息
    const groupName =
      companyUser.employment_type === 'teacher' ? '教职工' : '学生';
    // 通过转换函数获取新版id
    const newCompanyUserIdResp = await tokenServiceV7.idConvert({
      company_id: companyId,
      id_type: 'company_uid',
      ids: [companyUser.company_uid],
    });
    const newCompanyUserId = newCompanyUserIdResp.data[companyUser.company_uid];
    // 判断用户是否已经加入到用户组
    const userGroups = await userGroupService.getListOfUserGroups({
      joined: true,
      user_id: newCompanyUserId,
      type: ['org_normal', 'normal', 'org_dynamic'],
      with_total: true,
    });
    if (userGroups.data.total > 0) {
      logger.info(
        `用户${companyUser.name}已经在用户组${userGroups.data.items[0].name}中！`,
      );
      return;
    }
    //   获取所有的组信息
    const groups = await userGroupService.getListOfUserGroups({
      type: ['org_normal'],
    });
    //  获取匹配到的用户组信息
    const groupIds = (groups.data.items as any[])
      .filter(
        (item) => item.name.includes(groupName) && item.status === 'enable',
      )
      .map((item) => item.id);
    //  获取加入的组id
    let groupId: string;
    if (groupIds.length === 0) {
      logger.warn(`用户组${groupName}不存在`);
      const result = await userGroupService.createUserGroups({
        type: 'normal',
        name: groupName,
        visibility_type: 'all',
        creator_id: newCompanyUserId,
        owner_id: newCompanyUserId,
      });
      groupId = result.data.id;
    } else groupId = groupIds[0] as string;
    // 将用户加入到组中
    await userGroupService.addUserToGroup(groupId, {
      item_id: newCompanyUserId,
    });
    logger.info(`用户${companyUser.name}加入用户组${groupName}`);
  };

  const addUsersToGroup = async () => {
    let users = await wpsService.readAllUsers('active');
    users = users.filter((user) => user.third_union_id);
    for (const companyUser of users) {
      await sleep(100);
      const companyIdResp = await wpsService.tokenService.getCompanyId();
      const companyId = companyIdResp.company.company_id;
      await addUserToGroupByV1(companyId, companyUser);
    }
  };
  return {
    ...wpsService,
    addUsersToGroup,
    tokenServiceV7,
    userGroupService,
    addUserToGroupByV1,
  };
};
