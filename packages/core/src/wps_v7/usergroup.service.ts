import { type AxiosInstance } from 'axios';

import { TokenService } from './token.service';
import { toQueryString } from '../util/utils';

export interface UserGroupPO {
  dept_ids?: string[]; // 部门 id，获取部门关联的组 格式为 dept_ids={string_1}&dept_ids={string_2}
  exclude_dept_ids?: string[]; // 排除某些部门关联的组 格式为 exclude_dept_ids={string_1}&exclude_dept_ids={string_2}
  joined?: boolean; // 获取用户加入的用户组
  page_size?: number; // 分页大小
  page_token?: string; // 分页标记，第一次请求不填，表示从头开始遍历
  source?: string[]; // 用户组的业务方来源，默认为 default 格式为 source={string_1}&source={string_2}
  //   用户组状态
  // enable：正常；recycled：回收站
  // 格式为 status={string_1}&status={string_2}
  status?: string[];
  //   用户组类型，默认为 normal
  // normal：普通用户组；dept：部门用户组；org_dynamic：企业动态用户组；org_normal：企业静态用户组
  // 格式为 type={string_1}&type={string_2}
  type?: ('normal' | 'dept' | 'org_dynamic' | 'org_normal')[];
  //   用户 id
  // 没有指定，默认采用访问凭证对应的 user_id；有指定，需要满足访问者对该 user_id 的用户组有权限的条件
  user_id?: string;
  user_role?: any[]; // 按用户在组内的角色筛选组
  with_total?: boolean; // 是否返回 total 字段，默认不返回
}

export interface CreateUserGroupPO {
  creator_id: string; // 创建者 id
  dept_id?: string[]; // 关联部门，仅部门组才有此属性
  description?: string; // 描述介绍
  name: string; // 名称
  owner_id?: string; // 拥有者 id，企业组只能是本企业成员，个人组只能是自己
  source?: string; // 用户组的引用业务方，默认为 default
  // 可见类型
  // nobody：不可见；all：企业成员可见；group：组成员可见；specify：指定成员可见
  visibility_type?: 'nobody' | 'all' | 'group' | 'specify'; // 用户组的业务方来源，默认为 default 格式为 source={string_1}&source={string_2}
  //   用户组类型，默认为 normal
  // normal：普通用户组；dept：部门用户组；org_dynamic：企业动态用户组；org_normal：企业静态用户组
  // 格式为 type={string_1}&type={string_2}
  type?: 'normal' | 'dept' | 'org_dynamic' | 'org_normal';
}

export interface AddUserToGroupPO {
  about?: string; // 组成员个性签名
  item_id: string; // 组成员 id
  item_type?: 'normal' | 'dept'; // 组成员类型:normal：普通成员；dept：部门成员
  nickname?: string; // 组成员昵称
  role?: 'normal' | 'admin' | 'owner'; // 组成员角色 normal：普通成员；admin：管理员；owner：拥有者
}

export class UserGroupService {
  private readonly baseUri = '/v7/groups';

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
  async getListOfUserGroups(parameter: UserGroupPO) {
    try {
      const companyToken = await this.tokenService.companyToken();
      const resp = await this.wpsHttpClient.get(
        `${this.baseUri}?${toQueryString(parameter)}`,
        {
          headers: { Authorization: `Bearer ${companyToken}` },
        },
      );
      return resp.data;
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  /**
   * 创建用户(第三方ID)并添加到部门
   * @param parameter: 第三方平台Id
   */
  async createUserGroups(parameter: CreateUserGroupPO) {
    const companyToken = await this.tokenService.companyToken();
    const resp = await this.wpsHttpClient.post(
      `${this.baseUri}/create`,
      parameter,
      {
        headers: {
          Authorization: `Bearer ${companyToken}`,
        },
      },
    );
    return resp.data;
  }

  /**
   * 创建用户(第三方ID)并添加到部门
   * @param thirdUnionId: 第三方平台Id
   * @param user: 要创建的用户信息
   * @param depts: 用户所在的部门信息
   */
  async addUserToGroup(id: string, user: AddUserToGroupPO) {
    try {
      const companyToken = await this.tokenService.companyToken();
      const resp = await this.wpsHttpClient.post(
        `${this.baseUri}/${id}/members/create?`,
        user,
        {
          headers: { Authorization: `Bearer ${companyToken}` },
        },
      );
      return resp.data;
    } catch (e) {
      console.log(e);
      throw e;
    }
  }
}
