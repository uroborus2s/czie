import { type AxiosInstance } from 'axios';
import { TokenService } from './token.service';
import { CloudUserService } from './clouduser.service';
import { sleep } from '../util/utils';
import { asyncPool } from '../util/promise';

export interface DeptDO {
  name: string;
  order?: number;
  childrens?: DeptDO[];
}

export interface DepTypeDto {
  name?: string;
  deptPid?: string;
  order?: number;
  exDeptId?: string;
}

export interface DepTypeResp {
  name: string;
  // eslint-disable-next-line camelcase
  dept_pid: string;
  // eslint-disable-next-line camelcase
  dept_id: string;
  abs_path: string;
  id_path: string;
  ex_dept_id: string;
  order: number;
  ctime: number;
}

export interface DeptNodeRsp {
  // 第三方部门上级部门id
  deptPid?: string;
  // 第三方部门id
  deptId?: string;
  // 部门名称
  name: string;
  // 云文档上级部门id
  wpsDeptPid?: string;
  // 云文档部门id
  wpsDeptId?: string;
  // 部门类型 0:原始部门，1:自定义部门
  deptType: number;
  order?: number;
  [key: string]: any;
  children: DeptNodeRsp[];
}

export class CloudOrgService {
  private readonly deptsUri = '/plus/v1/company/depts';

  private rootDeptId: string;

  private rootDeptName: string;

  private tokenService: TokenService;

  private wpsHttpClient: AxiosInstance;

  private cloudUserService: CloudUserService;

  constructor(
    cloudUserService: CloudUserService,
    tokenService: TokenService,
    wpsHttpClient: AxiosInstance,
  ) {
    this.tokenService = tokenService;
    this.rootDeptId = '';
    this.rootDeptName = '';
    this.wpsHttpClient = wpsHttpClient;
    this.cloudUserService = cloudUserService;
  }

  /**
   * 创建云文档部门Id和第三方平台部门id的关联关系
   * @param dep: 部门数据，名称，父部门id，顺序号
   */
  async creatDepts(dep: DepTypeDto) {
    const companyToken = await this.tokenService.companyToken();
    let data = { ...dep };
    if (dep.deptPid === undefined) {
      const pid = await this.getRootDept();
      data = { ...dep, deptPid: pid };
    }
    const resp = await this.wpsHttpClient.post(
      `${this.deptsUri}?company_token=${companyToken}`,
      {
        name: data.name,
        dept_pid: data.deptPid,
        order: data.order,
        ...(data.exDeptId ? { ex_dept_id: data.exDeptId } : {}),
      },
    );
    return resp.data.dept_id as string;
  }

  /**
   * 删除云文档部门Id
   * @param deptId: 要删除的云文档部门ID
   * @param userIds: 部门中如果存在用户，则需要先把用户移出部门
   */
  async deleteDepts(deptId: string, userIds: string[]) {
    for (let i = 0; i < userIds.length; i += 1) {
      await sleep(50);
      await this.cloudUserService.removeUserFromDept(userIds[i], deptId);
    }
    const companyToken = await this.tokenService.companyToken();
    const resp = await this.wpsHttpClient.delete(
      `${this.deptsUri}/${deptId}?company_token=${companyToken}`,
    );
    return resp.data.result;
  }

  /**
   * 删除部门和下级所有部门
   * @param deptId: 要删除的云文档部门ID
   * @param empty: 是否将用户移除部门，默认false，存在用户则跳过,
   * return 无法删除返回false，成功删除返回true
   */
  async deleteAllDepts(deptId: string, empty: boolean = false) {
    const depts = await this.getChildDepts(deptId);
    let userIds = [];
    const users = await this.cloudUserService.getUsersInDept(deptId);
    const res: boolean[] = await asyncPool(
      1,
      depts.map((detpt) => async () => {
        try {
          return await this.deleteAllDepts(detpt.dept_id, empty);
        } catch (e) {
          return false;
        }
      }),
    );
    if (users.length > 0) {
      if (!empty) {
        return false;
      }
      userIds = users.map((user) => user.company_uid);
    }
    let result = !res.some((r) => !r);
    if (result) {
      try {
        const rootId = await this.getRootDept();
        if (deptId !== rootId) await this.deleteDepts(deptId, userIds);
      } catch (e) {
        console.log(e);
        result = false;
      }
    }
    return result;
  }

  /**
   * 修改部门
   * @param deptId: 部门ID
   * @param dep: 部门数据，名称，父部门id，顺序号
   */
  async updateDepts(deptId: string, dep: DepTypeDto) {
    const companyToken = await this.tokenService.companyToken();
    const data = await this.wpsHttpClient.put(
      `${this.deptsUri}/${deptId}?company_token=${companyToken}`,
      {
        ...(dep.exDeptId ? { ex_dept_id: dep.exDeptId } : {}),
        ...(dep.name ? { name: dep.name } : {}),
        ...(dep.order ? { order: dep.order } : {}),
        ...(dep.deptPid ? { dept_pid: dep.deptPid } : {}),
      },
    );
    return data.data.result;
  }

  /**
   * 获取部门信息
   * @param deptId: 要查询云文档部门ID
   * @return 返回文档云中台的部门信息
   */
  async getDeptInfo(deptId: string) {
    const companyToken = await this.tokenService.companyToken();
    const resp = await this.wpsHttpClient.get(
      `/plus/v1/batch/company/depts?company_token=${companyToken}&dept_ids=${deptId}`,
    );
    return resp.data.depts[0];
  }

  /**
   * 获取部门信息
   * @param exDeptId: 要查询云文档第三方部门ID
   * @return 返回文档云中台的部门信息
   */
  async getDeptInfoByExId(exDeptId: string) {
    const companyToken = await this.tokenService.companyToken();
    const resp = await this.wpsHttpClient.get(
      `${this.deptsUri}/by-ex-dept-ids?company_token=${companyToken}&ex_dept_ids=${exDeptId}`,
    );
    return resp.data.depts[0];
  }

  /**
   * 获取根部门id
   * @return 返回文档云中台的部门ID
   */
  async getRootDept() {
    if (this.rootDeptId === '') {
      const deptInfos = await this.getChildDepts('0');
      this.rootDeptId = deptInfos[0].dept_id;
      this.rootDeptName = deptInfos[0].name;
    }
    return this.rootDeptId;
  }

  /**
   * 获取根部门名称
   * @return 返回文档云中台的根部门名称
   */
  async getRootDeptName() {
    if (this.rootDeptName === '') {
      const deptInfos = await this.getChildDepts('0');
      this.rootDeptName = deptInfos[0].name;
    }
    return this.rootDeptName;
  }

  /**
   * 获取子部门列表
   * @param deptId: 部门ID
   * @param recursive: 是否递归
   * @return 返回所有部门列表的数组
   */
  async getChildDepts(deptId: string, recursive = false) {
    const companyToken = await this.tokenService.companyToken();
    let offset = 0;
    const depts = [] as DepTypeResp[];
    let dLength = 0;
    do {
      dLength = depts.length;
      const resp = await this.wpsHttpClient.get(
        `${this.deptsUri}/${deptId}/children?company_token=${companyToken}&offset=${offset}&limit=1000&recursive=${recursive}`,
      );
      await sleep(50);
      offset += 1000;
      if (
        resp.data.result === 0 &&
        Array.isArray(resp.data.depts) &&
        resp.data.depts.length > 0
      ) {
        depts.push(...resp.data.depts);
      }
    } while (depts.length - dLength >= 1000);

    return depts as DepTypeResp[];
  }

  /**
   * 获取企业部门下的企业成员列表
   * @param deptId: 部门id
   */
  async getAllUsersInDept(deptId: string): Promise<any[]> {
    const localUsers = [];
    const users = await this.cloudUserService.getUsersInDept(deptId);
    localUsers.push(...users);
    const depts = await this.getChildDepts(deptId);
    for (const dept of depts) {
      const cUsers = await this.getAllUsersInDept(dept.dept_id);
      localUsers.push(...cUsers);
    }
    return localUsers as any[];
  }

  /**
   * 递归创建部门
   * @param childs: 部门递归数据
   * @param deptPID: 父部门ID
   */
  async recursiveCreatDept(
    deptPID: string,
    childs: DeptDO[],
  ): Promise<string[]> {
    const nDepts: string[] = [];
    for (const child of childs) {
      const partenId = await this.creatDepts({
        ...(child.order ? { order: child.order } : {}),
        deptPid: deptPID,
        name: child.name,
      });
      nDepts.push(`${deptPID}-${partenId}`);
      if (child.childrens) {
        const cDepts = await this.recursiveCreatDept(partenId, child.childrens);
        nDepts.push(...cDepts);
      }
    }
    return nDepts;
  }

  private async getChildrenNodes(id: string) {
    const childNodes: DeptNodeRsp[] = [];
    const childs = await this.getChildDepts(id);
    for (let i = 0; i < childs.length; i += 1) {
      if (childs[i].ex_dept_id) {
        const children = await this.getChildrenNodes(childs[i].dept_id);
        await sleep(30);
        const pDeptInfo = await this.readDeptInfoById([childs[i].dept_pid]);
        childNodes.push({
          name: childs[i].name,
          wpsDeptPid: childs[i].dept_pid,
          wpsDeptId: childs[i].dept_id,
          deptType: 0,
          deptId: childs[i].ex_dept_id,
          deptPid: pDeptInfo[0].ex_dept_id,
          children,
        });
      }
    }
    return childNodes;
  }

  /**
   * 获取所有部门的信息包含递归子部门的信息
   * @param id: 部门ID
   * @return 返回部门的树形结构
   */
  async readAllDeptRecursion() {
    const rootId = await this.getRootDept();
    const rootName = await this.getRootDeptName();
    const children = await this.getChildrenNodes(rootId);
    return { name: rootName, wpsDeptId: rootId, children } as DeptNodeRsp;
  }

  async readDeptInfoById(ids: string[]) {
    const companyToken = await this.tokenService.companyToken();
    const axiosResponse = await this.wpsHttpClient.get(
      `/plus/v1/batch/company/depts?company_token=${companyToken}&dept_ids=${ids.join(
        ',',
      )}`,
    );
    const deptInfos = axiosResponse.data.depts;
    if (Array.isArray(deptInfos) && deptInfos.length > 0) {
      return deptInfos;
    }
    return [];
  }

  /**
   * 根据部门名称查找子部门
   * @param deptName: 查找子部门名称
   * @param deptPid: 父部门ID
   */
  async searchDeptByName(deptName: string, deptPid?: string) {
    let pId = deptPid;
    const companyToken = await this.tokenService.companyToken();
    if (!pId) {
      pId = await this.getRootDept();
    }
    const resp = await this.wpsHttpClient.get(
      `/kopen/plus/v1/companies/depts/child?company_token=${companyToken}&dept_pid=${pId}&dept_name=${deptName}`,
    );

    return resp.data;
  }
}
