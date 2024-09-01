import type {
  KSCIMConfig,
  KScimDeptInfo,
  ResponseBody,
  KScimUserInfo,
  ExLocalService as LocalService,
} from '@wps/types-context';
import dayjs from 'dayjs';
import { OauthByCas, type OauthByCasOptions } from '../sso/cas';
import { sleep } from '../util/utils';
import type { WpsService } from './service';

export interface KScimServiceOptions<Config extends KSCIMConfig>
  extends OauthByCasOptions<Config> {
  studentDeptId?: string;
  teacherDeptId?: string;
  wpsService: WpsService;
  localService: LocalService;
}

export abstract class KScimService<
  Config extends KSCIMConfig = KSCIMConfig,
> extends OauthByCas<Config> {
  protected readonly studentDeptId;

  protected readonly teacherDeptId;

  private wpsService: WpsService;

  protected localService: LocalService;

  public constructor(options: KScimServiceOptions<Config>) {
    super(options);
    this.teacherDeptId = options.teacherDeptId || 'wps-teacher-001';
    this.studentDeptId = options.studentDeptId || 'wps-studer-001';
    this.wpsService = options.wpsService;
    this.localService = options.localService;
  }

  verifyToken(token: string) {
    return token === this.config.KSCIMToken;
  }

  changeRootDirectory(datas: KScimDeptInfo[]) {
    datas.push(
      {
        dept_id: this.teacherDeptId,
        dept_pid: this.config.KSCIMDeptRootId,
        name: '教职工',
        order: 0,
      },
      {
        dept_id: this.studentDeptId,
        dept_pid: this.config.KSCIMDeptRootId,
        name: '学生',
        order: 0,
      },
    );
  }

  async getChildGroups(deptId: string): Promise<ResponseBody> {
    this.logger.info(`读取部门${deptId}下的子部门信息中......`);
    let rows = await this.localService.readChildDepts(deptId);
    rows = rows.filter((row) => row.deptId !== row.deptPid);

    const datas: KScimDeptInfo[] = rows.map((row) => ({
      dept_id: row.deptId,
      dept_pid: row.deptPid,
      name: row.name,
      order: Number(row.order || 0),
    }));
    return { code: 0, datas, total: datas.length, msg: 'success' };
  }

  async getUserInfos(deptId?: string): Promise<ResponseBody> {
    this.logger.info(`读取部门${deptId || 'all'}下的用户信息中......`);
    const datas: KScimUserInfo[] = [];
    let rows;
    if (deptId) rows = await this.localService.readChildUsers(deptId);
    else
      rows = (await this.localService.readAllUsers()).map((user) => ({
        user_id: user.userId,
        name: user.name,
        phone: user.phone || undefined,
        email: user.email || undefined,
        title: user.title || undefined,
        employee_id: user.employeeId,
        dept_id: user.depts.map((dept) => dept.thirdDeptId),
      }));
    datas.push(
      ...rows.map((row) => ({
        user_id: row.user_id,
        name: row.name,
        dept_id: row.dept_id,
        title: row.title || null,
        phone: row.phone || null,
        employee_id: row.employee_id || null,
        email: row.email || null,
      })),
    );
    return { code: 0, datas, total: datas.length, msg: 'success' };
  }

  async writeEmployeeId(fireDate: Date) {
    this.logger.info(
      `${dayjs(fireDate).format(
        'YYYY-MM-DD HH:mm:ss',
      )}开始写入employeeId......`,
    );
    const start = dayjs().unix();
    let total = 0;
    const users = (await this.getUserInfos()).datas as KScimUserInfo[];
    for (const user of users) {
      await sleep(30);
      const ids = await this.wpsService.cloudUserService.getUserIdByThirdIds([
        user.user_id,
      ]);
      if (ids.length > 0) {
        const wpsUsers = await this.wpsService.cloudUserService.getUserInfos([
          ids[0],
        ]);
        if (wpsUsers.length && !wpsUsers[0].employee_id) {
          await this.wpsService.cloudUserService.updateUser(
            wpsUsers[0].company_uid,
            { employeeId: user.user_id },
          );
          total += 1;
          this.logger.info(
            `修改用户${user.name},id:${user.user_id}的工号成功！`,
          );
        }
      }
    }
    const end = dayjs().unix();
    this.logger.info(`绑定${total}个工号成功！总共耗时${end - start}秒`);
  }

  async readAddressBooks(ctx: any, type: 'group' | 'user') {
    const { token, dept_id: deptId } = ctx.query;
    let status = 400;
    let body = { msg: 'success', code: 0 } as any;
    if (this.verifyToken(token)) {
      try {
        const start = dayjs().unix();
        if (type === 'group') {
          body = await this.getChildGroups(deptId);
        } else {
          body = await this.getUserInfos(deptId);
        }
        status = 200;
        const end = dayjs().unix();
        this.logger.info(`返回${body.total}条数据,总共耗时${end - start}秒`);
      } catch (e) {
        this.logger.error(JSON.stringify(e));
        body = {
          msg: 'An unknown error occurred',
          code: status,
        };
      }
    } else {
      status = 403;
      body = {
        msg: 'No Access',
        code: 403,
      };
    }
    ctx.status = status;
    ctx.body = body;
  }
}
