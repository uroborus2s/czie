import { type AxiosInstance } from 'axios';

import { TokenService } from './token.service';
import { sleep } from '../util/utils';

export interface UserTypeDto {
  loginName?: string;
  password?: string;
  name?: string;
  thirdUnionId?: string;
  deptId?: string;
  roleId?: number;
  email?: string;
  employeeId?: string;
  phone?: string;
  title?: string;
  employmentType?: string;
}

export interface UserMode {
  company_uid: string; // 企业成员id
  name: string; // 成员名
  third_union_id?: string; // 第三方unionid (仅第三方同步到WPS的场景需要关注)
  role_id: number; // 成员角色id。1：超管，2：管理员，3：普通成员
  status: string; // 成员状态。active(正常),notactive(未激活), disabled(禁用)
  email?: string; // 成员邮箱
  phone?: string; // 成员手机号
  ctime?: number; // 成员创建时间，秒为单位的时间戳
  order?: number;
  depts: { id: string; name: string }[];
  title?: string;
  employee_id?: string;
  employment_type?: string;
}

export class CloudUserService {
  private readonly baseUri = '/plus/v1/company';

  private readonly companyUsersUri = `${this.baseUri}/company_users`;

  private readonly companyUsersUriV2 = `${this.baseUri}/users`;

  private readonly bathUserUri = '/plus/v1/batch/company/company_users';

  private readonly baseDeptsUrl = (deptId: string) =>
    `/plus/v1/company/depts/${deptId}`;

  private readonly deptOfCompanyUsers = (deptId: string) =>
    `${this.baseDeptsUrl(deptId)}/company_users`;

  private readonly bathDeptOfCompanyUsers = (deptId: string) =>
    `/plus/v1/batch/company/depts/${deptId}/company_users`;

  private wpsHttpClient: AxiosInstance;

  private tokenService: TokenService;

  constructor(tokenService: TokenService, wpsHttpClient: AxiosInstance) {
    this.tokenService = tokenService;
    this.wpsHttpClient = wpsHttpClient;
  }

  /**
   * 创建用户(第三方ID)并添加到部门
   * @param thirdUnionId: 第三方平台Id
   * @param user: 要创建的用户信息
   * @param depts: 用户所在的部门信息
   */
  async createUserAndAddToDept(
    thirdUnionId: string,
    user: UserTypeDto,
    depts: string[],
  ) {
    const companyUid = await this.createNewUser(user);
    await Promise.all(
      depts.map((depId) => this.addUserToDept(companyUid, depId)),
    );
    return companyUid;
  }

  /**
   * 根据第三方ID删除用户
   * @param thirdUnionId: 第三方平台Id
   */
  async deleteUserByThirdId(thirdUnionId: string) {
    const userId = await this.getUserIdByThirdIds([thirdUnionId]);
    const resp = await this.deleteUser(userId[0]);
    return resp;
  }

  /**
   * 根据第三方ID修改用户
   * @param thirdUnionId: 第三方平台Id
   */
  async updateUserByThirdId(thirdUnionId: string, user: UserTypeDto) {
    const userId = await this.getUserIdByThirdIds([thirdUnionId]);
    const resp = await this.updateUser(userId[0], user);
    return resp;
  }

  /**
   * 根据第三方ID启用用户
   * @param thirdUnionId: 第三方平台Id
   */
  async enableUserByThirdId(thirdUnionId: string) {
    const companyId = await this.getUserIdByThirdIds([thirdUnionId]);
    const result = await this.bathEnableUsers([companyId[0]]);
    return result;
  }

  /**
   * 根据第三方ID停用用户
   * @param thirdUnionId: 第三方平台Id
   */
  async disableUserBythirdId(thirdUnionId: string) {
    const companyId = await this.getUserIdByThirdIds([thirdUnionId]);
    const result = await this.bathDisableUsers([companyId[0]]);
    return result;
  }

  /**
   * 调整部门
   * @param thirdUnionId: 第三方平台Id
   */
  async adjustDeptByThirdId(
    thirdUnionId: string,
    oldDepId: string,
    newDepId: string,
  ) {
    const companyId = await this.getUserIdByThirdIds([thirdUnionId]);
    await this.removeUserFromDept(companyId[0], oldDepId);
    await this.addUserToDept(companyId[0], newDepId);
  }

  /**
   * 调整部门
   */
  async adjustDept(
    companyId: string,
    oldDepId: string | null,
    newDepId: string,
  ) {
    if (oldDepId) await this.removeUserFromDept(companyId, oldDepId);
    await this.addUserToDept(companyId, newDepId);
  }

  /** ****************** 根据用户ID操作用户 ******************************** */
  /**
   * 新建一个新的企业用户
   * @param user: 用户基本信息
   */
  async createNewUser(user: UserTypeDto) {
    const companyToken = await this.tokenService.companyToken();
    const resp = await this.wpsHttpClient.post(
      `${this.companyUsersUri}?company_token=${companyToken}`,
      {
        name: user.name,
        role_id: user.roleId,
        third_union_id: user.thirdUnionId,
        ...(user.email ? { email: user.email } : {}),
        ...(user.employeeId ? { employee_id: user.employeeId } : {}),
        ...(user.title ? { title: user.title } : {}),
        ...(user.phone ? { phone: user.phone } : {}),
      },
    );
    if (process.env.DEBUG === 'TRUE') {
      console.log(JSON.stringify(resp.headers));
      console.log(JSON.stringify(resp.config.url));
      console.log(JSON.stringify(resp.config.method));
      console.log(JSON.stringify(resp.config.baseURL));
    }
    return resp.data['company_uid'];
  }

  /**
   * 新建一个新的企业用户V2版本
   * @param user: 用户基本信息
   */
  async createNewUser_V2(user: UserTypeDto) {
    const companyToken = await this.tokenService.companyToken();
    const resp = await this.wpsHttpClient.post(
      `${this.companyUsersUriV2}?company_token=${companyToken}`,
      {
        name: user.name,
        third_union_id: user.thirdUnionId,
        dept_id: user.deptId,
        ...(user.email ? { email: user.email } : {}),
        ...(user.employeeId ? { employee_id: user.employeeId } : {}),
        ...(user.title ? { title: user.title } : {}),
        ...(user.phone ? { phone: user.phone } : {}),
        ...(user.employmentType
          ? { employment_type: user.employmentType }
          : {}),
      },
    );
    return resp.data['company_uid'];
  }

  /**
   * 修改云文档部门的用户信息
   * @param userId: 用户id
   * @param user: 要修改的用户信息
   */
  async updateUser(userId: string, user: UserTypeDto) {
    const companyToken = await this.tokenService.companyToken();
    const resp = await this.wpsHttpClient.put(
      `${this.companyUsersUri}/${userId}?company_token=${companyToken}`,
      {
        ...(user.name ? { name: user.name } : {}),
        ...(user.password ? { password: user.password } : {}),
        ...(user.roleId ? { role_id: user.roleId } : {}),
        ...(user.email !== undefined && user.email !== null
          ? { email: user.email }
          : {}),
        ...(user.employeeId !== undefined && user.employeeId !== null
          ? { employee_id: user.employeeId }
          : {}),
        ...(user.phone !== undefined && user.phone !== null
          ? { phone: user.phone }
          : {}),
        ...(user.title !== undefined && user.title !== null
          ? { title: user.title }
          : {}),
        ...(user.employmentType
          ? { employment_type: user.employmentType }
          : {}),
      },
    );
    return resp.data.result;
  }

  /**
   * 删除用户信息
   * @param userId: 用户ID
   */
  async deleteUser(userId: string) {
    try {
      const companyToken = await this.tokenService.companyToken();
      const resp = await this.wpsHttpClient.delete(
        `${this.companyUsersUri}/${userId}?company_token=${companyToken}`,
      );
      return resp.data.result;
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  /**
   * 同步企业成员third_union_id
   * @param userId: 用户ID
   */
  async thirdBindUnionId(userId: string, thirdUnionId: string) {
    const companyToken = await this.tokenService.companyToken();
    const resp = await this.wpsHttpClient.post(
      `${this.companyUsersUri}/${userId}/third-bind?company_token=${companyToken}`,
      {
        third_union_id: thirdUnionId,
      },
    );
    return resp.data.result;
  }

  async getUserDecrease(
    url: (companyToken: string | undefined, offset: number) => string,
  ) {
    const companyToken = await this.tokenService.companyToken();
    let offset = 0;
    const users = [];
    let cLength = 0;
    do {
      cLength = users.length;
      const resp = await this.wpsHttpClient.get(url(companyToken, offset));
      await sleep(50);
      offset += 1000;
      if (
        resp.data.result === 0 &&
        Array.isArray(resp.data['company_users']) &&
        resp.data['company_users'].length > 0
      ) {
        users.push(...resp.data['company_users']);
      }
    } while (users.length - cLength >= 1000);
    return users;
  }

  /**
   * 获取企业的所有企业成员列表
   */
  async getAllUsers(status?: string): Promise<UserMode[]> {
    const url = (companyToken: string | undefined, offset: number) =>
      `${this.companyUsersUri}?company_token=${companyToken}&offset=${offset}&limit=1000&status=${status || 'active,notactive,disabled'}`;
    const users = await this.getUserDecrease(url);
    return users;
  }

  // 可选值：active(正常),notactive(未激活), “dimission”(离职),disabled(禁用)
  async getAllDimissionUsers(status: string): Promise<UserMode[]> {
    const url = (companyToken: string | undefined, offset: number) =>
      `${this.companyUsersUri}?company_token=${companyToken}&offset=${offset}&limit=1000&status=${status}`;
    const users = await this.getUserDecrease(url);
    return users;
  }

  /**
   * 获取企业部门下的企业成员列表
   * @param deptId: 部门id
   */
  async getUsersInDept(deptId: string) {
    const uri = this.deptOfCompanyUsers(deptId);
    const url = (companyToken: string | undefined, offset: number) =>
      `${uri}?company_token=${companyToken}&offset=${offset}&limit=1000&status=active,notactive,disabled`;
    const users = await this.getUserDecrease(url);
    return users;
  }

  /**
   * 将企业成员添加到部门
   * @param userId: 用户Id
   * @param deptId: 部门Id
   */
  async addUserToDept(userId: string, deptId: string) {
    const companyToken = await this.tokenService.companyToken();
    const uri = this.deptOfCompanyUsers(deptId);
    const resp = await this.wpsHttpClient.post(
      `${uri}/${userId}?company_token=${companyToken}`,
    );
    if (process.env.DEBUG === 'TRUE') {
      console.log(JSON.stringify(resp.headers));
      console.log(JSON.stringify(`请求参数,url:${resp.config.url}`));
      console.log(JSON.stringify(resp.config.method));
      console.log(JSON.stringify(resp.config.baseURL));
    }
    return resp.data.result;
  }

  /**
   * 将企业成员移出部门
   * @param userId: 用户Id
   * @param deptId: 部门Id
   */
  async removeUserFromDept(userId: string, deptId: string) {
    const companyToken = await this.tokenService.companyToken();
    const uri = this.deptOfCompanyUsers(deptId);
    const resp = await this.wpsHttpClient.delete(
      `${uri}/${userId}?company_token=${companyToken}`,
    );
    return resp.data.result;
  }

  /**
   * 批量将企业成员移出部门
   * @param deptId: 部门Id
   * @param companyUids: 企业成员id的集合
   */
  async bathRemoveUserFromDept(deptId: string, companyUids: string[]) {
    const companyToken = await this.tokenService.companyToken();
    const uri = this.bathDeptOfCompanyUsers(deptId);
    const uids = companyUids.join(',');
    const resp = await this.wpsHttpClient.delete(
      `${uri}?company_token=${companyToken}&company_uids=${uids}`,
    );
    return resp.data.result;
  }

  /**
   * 批量获取部门下的企业成员
   * @param deptId: 部门Id
   * @param companyUids: 企业成员id的集合
   */
  async bathReadUserFromDept(deptId: string, companyUids: string[]) {
    const companyToken = await this.tokenService.companyToken();
    const uri = this.bathDeptOfCompanyUsers(deptId);
    const uids = companyUids.join(',');
    const resp = await this.wpsHttpClient.get(
      `${uri}?company_token=${companyToken}&company_uids=${uids}&status=active,notactive`,
    );
    return resp.data.company_users as any[];
  }

  /**
   * 批量通过third_union_id查询企业成员
   * @param thirdUnionIds: 第三方用户id
   */
  async getUserIdByThirdIds(thirdUnionIds: string[]) {
    const companyToken = await this.tokenService.companyToken();
    const companys = await this.wpsHttpClient.post(
      `${this.companyUsersUri}/by-third-union-ids?company_token=${companyToken}`,
      {
        third_union_ids: thirdUnionIds.join(','),
        status: 'active,notactive,disabled',
      },
    );
    if (process.env.DEBUG === 'TRUE') {
      console.log(JSON.stringify(companys.headers));
      console.log(JSON.stringify(companys.config.url));
      console.log(JSON.stringify(companys.config.method));
      console.log(JSON.stringify(companys.config.baseURL));
    }
    const userIds = companys.data.data['company_users'];
    if (Array.isArray(userIds) && userIds.length > 0) {
      return userIds.map((user) => user['company_uid']);
    }
    return [];
  }

  async getUsersByThirdIds(thirdUnionIds: string[], status?: string) {
    const companyToken = await this.tokenService.companyToken();
    const companys = await this.wpsHttpClient.post(
      `${this.companyUsersUri}/by-third-union-ids?company_token=${companyToken}`,
      {
        third_union_ids: thirdUnionIds.join(','),
        status: status || 'active,notactive,disabled',
      },
    );
    const users = companys.data.data['company_users'];
    return Array.isArray(users) && users.length > 0 ? users : [];
  }

  async getUserInfos(unionIds: string[], status?: string) {
    const companyToken = await this.tokenService.companyToken();
    const companys = await this.wpsHttpClient.get(
      `${
        this.bathUserUri
      }?company_token=${companyToken}&company_uids=${unionIds.join(
        ',',
      )}&status=${status || 'active,notactive,disabled'}`,
    );
    const userInfos = companys.data['company_users'];
    if (Array.isArray(userInfos) && userInfos.length > 0) {
      return userInfos;
    }
    return [];
  }

  async getUserDepsInfo(uids: string[]) {
    const companyToken = await this.tokenService.companyToken();
    const depts = await this.wpsHttpClient.post(
      `${this.baseUri}/user_depts/batch?company_token=${companyToken}`,
      {
        comp_uids: uids,
        status: ['active', 'notactive'],
      },
    );
    const usersDepts = depts.data['users_depts'];
    if (Array.isArray(usersDepts) && usersDepts.length > 0) {
      return usersDepts;
    }
    return [];
  }

  /**
   * 批量修改部门成员排序值
   * @param depts: 修改用户的orders
   */
  async bathUpdateUserOrder(
    depts: { company_uid: string; dept_id: string; order: number }[],
  ) {
    const companyToken = await this.tokenService.companyToken();
    const resp = await this.wpsHttpClient.put(
      `${this.baseUri}/deptmembers/order/reset?company_token=${companyToken}`,
      { depts },
    );
    return resp.data.result;
  }

  /**
   * 批批量启用企业成员
   * @param companyUids: 云文档中台用户IDs
   */
  async bathEnableUsers(companyUids: string[]) {
    const companyToken = await this.tokenService.companyToken();
    const companyIds = companyUids.join(',');
    const resp = await this.wpsHttpClient.put(
      `${this.bathUserUri}/enable?company_token=${companyToken}&company_uids=${companyIds}`,
    );
    return resp.data.result;
  }

  /**
   * 批量禁用企业成员
   * @param companyUids: 云文档中台用户IDs
   */
  async bathDisableUsers(companyUids: string[]) {
    const companyToken = await this.tokenService.companyToken();
    const companyIds = companyUids.join(',');
    const resp = await this.wpsHttpClient.put(
      `${this.bathUserUri}/disable?company_token=${companyToken}&company_uids=${companyIds}`,
    );
    return resp.data.result;
  }

  /**
   * 批量激活企业成员
   * @param companyUids: 云文档中台用户IDs
   */
  async bathActiveUsers(companyUids: string[]) {
    const companyToken = await this.tokenService.companyToken();
    const resp = await this.wpsHttpClient.put(
      '/kopen/v1/dev/company/users/active/batch',
      {
        company_token: companyToken,
        company_uids: companyUids,
      },
    );
    return resp.data.result;
  }

  /**
   * 搜索部门成员
   * @param deptId: 部门Id
   */
  async searchUsersInDept(
    deptId: string,
    searchName: string,
  ): Promise<UserMode[]> {
    const companyToken = await this.tokenService.companyToken();
    let searchUrl = `${this.baseDeptsUrl(
      deptId,
    )}/search/members?company_token=${companyToken}&search_name=${searchName}`;
    searchUrl = searchUrl.replace(/([\u4e00-\u9fa5])/g, (str) =>
      encodeURIComponent(str),
    );
    const resp = await this.wpsHttpClient.get(searchUrl);
    return resp.data.members;
  }
}
