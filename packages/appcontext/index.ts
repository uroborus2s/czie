import { type Logger } from 'winston';
import { type CreateAxiosDefaults } from 'axios';

export interface BaseConfig {
  port: number;
  appid: string;
  appkey: string;
  wpsCloudUrl: string;
  axios: CreateAxiosDefaults;
  redisUrl: string;
  casServer: string;
  casValidate: string;
  localUrl: string;
  ssoAppId: string;
  step: string;
}

export interface KSCIMConfig extends BaseConfig {
  KSCIMToken: string;
  KSCIMDeptRootId: string;
}

export interface ContextService {
  init(): Promise<unknown>;

  close(): Promise<unknown>;

  [key: string]: unknown;
}

export interface CreateServiceOptions<Config> {
  config: Config;
  logger: Logger;

  getService<CService extends ContextService>(
    serviceName: string,
  ): CService | undefined;
}

export interface ServiceConstructor {
  <Config>(
    serviceName: string,
    options: CreateServiceOptions<Config>,
  ): ContextService;
}

export interface Context<Config extends BaseConfig> {
  logger: Logger;
  config: Config;
}

export interface DeptBaseEntity {
  // 第三方部门上级部门id
  org_id: string;
  // 第三方部门id
  org_name: string;
  // 部门名称
  parent_unit_id: string | null;
  org_order: number;
  status: string;
}

export interface RemoteDeptBaseInfo {
  // 第三方部门上级部门id
  deptPid: string;
  // 第三方部门id
  deptId: string;
  // 部门名称
  name: string;
  order?: number;
  updateTime?: string;
  createTime?: string;
  status?: string;
  [key: string]: any;
}

export interface RemoteDeptInfo {
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

  children: RemoteDeptInfo[];
}

export interface KScimUserInfo {
  user_id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  title?: string | null;
  employee_id?: string | null;
  dept_id: string | string[];
  createTime?: string;
  updateTime?: string;
}

export interface KScimDeptInfo {
  dept_id: string;
  dept_pid: string;
  name: string;
  order?: number;
}

export interface RemoteUserInfo {
  userId: string;
  wpsUid?: string;
  name: string;
  depts: Array<{ id: string; name?: string; thirdDeptId: string }>;
  phone?: string | null;
  email?: string | null;
  title?: string | null;
  order?: string | null;
  employeeId?: string | null;
  status?: string | null;
  employmentType?: string;
  createTime?: string;
  updateTime?: string;
}

export interface ResponseBody {
  code: number;
  msg: string;
  total: number;
  datas: KScimDeptInfo[] | KScimUserInfo[];
}

export interface UpdateInfo {
  name?: string;
  add: Array<{ id: string; name?: string; thirdDeptId: string }>;
  del: Array<{ id: string; name?: string }>;
  phone?: string | null;
  email?: string | null;
  title?: string | null;
  employeeId?: string | null;
}

export interface LocalDeptService extends ContextService {
  initFromWps(rootNode: RemoteDeptInfo): Promise<void>;

  addDept(deptInfo: Omit<RemoteDeptInfo, 'children'>): Promise<unknown>;

  deleteDept(deptId: string): Promise<unknown>;

  readWpsDeptId(deptId: string): Promise<string | undefined>;
}

export interface LocalService extends ContextService {
  readAllUsers(): Promise<RemoteUserInfo[]>;

  addUsers(users: RemoteUserInfo[]): Promise<unknown>;

  removeUsers(users: RemoteUserInfo[]): Promise<unknown>;

  readUserByExId(id: string): Promise<RemoteUserInfo | undefined>;

  searchUserByName(name: string): Promise<RemoteUserInfo[] | undefined>;

  createUser(
    user: RemoteUserInfo,
    depts: Array<{ id: string; name: string }>,
  ): Promise<unknown>;
  updateUser(
    user: RemoteUserInfo,
    depts: Array<{ id: string; name: string }>,
  ): Promise<unknown>;
  deleteUser(id: string): Promise<unknown>;
}

export interface ExLocalService extends LocalService {
  addOrgs(orgs: RemoteDeptBaseInfo[]): Promise<unknown>;
  addOrg(orgs: Partial<DeptBaseEntity>): Promise<unknown>;
  updateOrg(orgs: Partial<DeptBaseEntity>): Promise<unknown>;
  deleteOrg(id: string): Promise<unknown>;

  readChildDepts(id?: string): Promise<RemoteDeptBaseInfo[]>;

  readChildUsers(id: string): Promise<KScimUserInfo[]>;

  updateSameNameOfDepts(): Promise<void>;

  readParentDeptId(id: string): Promise<RemoteDeptBaseInfo>;
}

export interface IgnoreService extends ContextService {
  ignores(): Promise<Array<Record<string, unknown>>>;
}
