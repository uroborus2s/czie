import axios from 'axios';
import type {
  BaseConfig,
  LocalDeptService,
  LocalService,
  RemoteDeptInfo,
  RemoteUserInfo,
  ServiceConstructor,
} from '@wps/types-context';
import dayjs from 'dayjs';
import {
  asyncPool,
  buildDeptTree,
  CalendarService,
  CloudOrgService,
  CloudUserService,
  diffOfArray,
  type ErrorService,
  GroupsService,
  type RemoteService,
  sleep,
  SpacesService,
  TokenService,
  type UserMode,
  type UserTypeDto,
  verifyEmail,
  verifyEmployeeId,
  verifyPhone,
  WPS3Sign,
  type WpsService,
} from '@wps/core';
import { type AfterSyncService } from './afterSyncService';

export const createWpsService: ServiceConstructor = (
  serviceName,
  options,
): WpsService => {
  const { logger, getService } = options;
  const config = options.config as BaseConfig;
  logger.info(`创建${serviceName}对象`);
  const wpsHttpClient = axios.create({
    baseURL: config.wpsCloudUrl,
    ...config.axios,
  });

  const errorService = getService('errorService') as ErrorService;

  const afterSyncService = getService('afterSyncService') as AfterSyncService;

  wpsHttpClient.interceptors.request.use(
    (req) => WPS3Sign(req, config.appid, config.appkey),
    (error) => Promise.reject(error),
  );

  const localDeptsService = getService('localDeptService') as LocalDeptService;

  const localService = getService('localService') as LocalService;

  const tokenService = new TokenService(config.appid, wpsHttpClient);
  const cloudUserService = new CloudUserService(tokenService, wpsHttpClient);
  const cloudOrgService = new CloudOrgService(
    cloudUserService,
    tokenService,
    wpsHttpClient,
  );

  const spacesService = new SpacesService(tokenService, wpsHttpClient);

  const groupsService = new GroupsService(tokenService, wpsHttpClient);

  const calendarService = new CalendarService(tokenService, wpsHttpClient);

  const init = () => Promise.resolve();

  const close = () => Promise.resolve();

  const remoteService = getService('remoteService') as RemoteService;

  const readAllUsers = async (status?: string) => {
    logger.info('从云文档中读取所有的用户信息');
    const start = dayjs().unix();
    const users = await cloudUserService.getAllUsers(status);
    const end = dayjs().unix();
    logger.info(
      `从wps云文档中读取到${users.length}个用户，耗时${end - start}秒。`,
    );
    return users;
  };

  const createOrgIfOrgNotExist = async (thirdDeptId: string | null) => {
    let wpsId: string = await cloudOrgService.getRootDept();
    if (thirdDeptId) {
      const wpsOrg = await cloudOrgService.getDeptInfoByExId(thirdDeptId);
      if (wpsOrg) {
        wpsId = wpsOrg.dept_id;
      } else if (localService.readParentDeptId) {
        const currentDept = await (localService as any).readParentDeptId(
          thirdDeptId,
        );
        const parentId = await createOrgIfOrgNotExist(currentDept.deptPid);
        wpsId = await cloudOrgService.creatDepts({
          deptPid: parentId,
          name: currentDept.name,
          order: currentDept.org_order,
          exDeptId: currentDept.deptId,
        });
      }
    }
    return wpsId;
  };

  const syncDepartmentOfUser = async (
    user: RemoteUserInfo,
    wpsUser: UserMode,
  ) => {
    // 2.部门不同，转移到不同的部门
    for (const dept of user.depts) {
      await sleep(20);
      dept.id = await createOrgIfOrgNotExist(dept.thirdDeptId);
    }

    const { add, dele } = diffOfArray(
      wpsUser.depts,
      user.depts,
      (a, b) => a.id === b.id,
    );
    for (const value of add) {
      await sleep(20);
      if (value.id) {
        await cloudUserService.addUserToDept(wpsUser.company_uid, value.id);
        logger.info(
          `修改用户的部门-${user.name || user.userId}将被加入到部门${
            value.name
          }`,
        );
      }
    }
    for (const value of dele) {
      await sleep(20);
      if (value.id) {
        await cloudUserService.removeUserFromDept(
          wpsUser.company_uid,
          value.id,
        );
        logger.info(`修改用户的部门-${user.name}将从部门${value.name}删除！`);
      }
    }

    return { add, dele };
  };

  const addUser = async (user: RemoteUserInfo) => {
    const createUserInfo = {
      name: user.name,
      thirdUnionId: user.userId,
      phone: verifyPhone(user.phone || undefined),
      email: verifyEmail(user.email || undefined),
      title: user.title || undefined,
      employeeId: verifyEmployeeId(user.employeeId || undefined),
      employmentType: user.employmentType,
    };
    const addNewUser = async (createInfo: any) => {
      let userId: string = '';
      try {
        userId = await cloudUserService.createNewUser(createInfo);
      } catch (e: any) {
        if (e && e.response && e.response.data) {
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
            logger.warn(
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
      try {
        await sleep(50);
        const userId = await addUser(user);

        // 修改用户到正确到部门
        await syncDepartmentOfUser(user, {
          company_uid: userId as string,
          depts: [] as { id: string; name: string }[],
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

  const activateUser = async (userId: string, username?: string) => {
    const companyUids = await cloudUserService.getUserIdByThirdIds([userId]);
    if (companyUids.length === 0) {
      const remoteUserInfo = await localService.readUserByExId(userId);
      if (process.env.DEBUG === 'TRUE') {
        logger.info('新建用户信息');
        logger.info(JSON.stringify(remoteUserInfo));
      }
      if (remoteUserInfo) {
        await addUsers([
          { ...remoteUserInfo, name: username || remoteUserInfo.name },
        ]);
      }
    }
  };

  const privateEditUsers = async (
    name: string,
    companyUid: string,
    info: Record<string, any>,
  ) => {
    try {
      await sleep(20);
      await cloudUserService.updateUser(companyUid, info);
      logger.info(`修改用户信息-修改${name}的信息为${JSON.stringify(info)}`);
    } catch (e: any) {
      if (e && e.response && e.response.data) {
        if ([10401006, 10401038, 10401007].includes(e.response.data.result)) {
          if (e.response.data.result === 10401006) delete info.phone;
          else if (
            e.response.data.result === 10401038 ||
            e.response.data.result === 10401007
          )
            delete info.email;
          logger.warn(`修改用户${name}-${e.response.data.msg || e.message}`);
          if (Object.keys(info).length > 0) {
            await privateEditUsers(name, companyUid, info);
          }
        } else {
          logger.error(`axios error:${JSON.stringify(e.response.data)}`);
        }
      } else {
        throw e;
      }
    }
  };

  const editUsers = async (users: RemoteUserInfo[], wpsUsers: UserMode[]) => {
    let total = 0;
    const start = dayjs().unix();
    for (const user of users) {
      try {
        let info = {} as UserTypeDto;
        const wpsUser = wpsUsers.find((u) => u.third_union_id === user.userId);
        if (wpsUser) {
          //   找到相同的人员，修改
          // 1.名称不同，修改姓名，电话，邮箱等信息

          const title = user.title || '';
          if (title !== wpsUser.title) {
            info.title = title;
          }
          if (user.name && user.name !== wpsUser.name) {
            info.name = user.name;
          }
          if (
            user.employmentType &&
            user.employmentType !== wpsUser.employment_type
          ) {
            info.employmentType = user.employmentType;
          }
          const employeeId = user.employeeId || '';
          if (employeeId !== wpsUser.employee_id) {
            info.employeeId = employeeId;
          }
          const email = user.email || '';
          if (email && email !== wpsUser.email) {
            info.email = verifyEmail(email);
          }

          const phone = user.phone || '';
          if (phone && phone !== wpsUser.phone) {
            info.phone = verifyPhone(phone);
          }
          info = JSON.parse(JSON.stringify(info)) as UserTypeDto;
          if (Object.keys(info).length > 0) {
            await privateEditUsers(wpsUser.name, wpsUser.company_uid, info);
          }
          const { add, dele } = await syncDepartmentOfUser(user, wpsUser);

          if (
            add.length > 0 ||
            dele.length > 0 ||
            Object.keys(info).length > 0
          ) {
            await afterSyncService.afterEditUsers(user, {
              ...info,
              add,
              del: dele,
            });
          }
        }
        total += 1;
      } catch (e) {
        console.log(e);
        await errorService.catchLog('修改用户失败', JSON.stringify(e));
      }
    }
    const end = dayjs().unix();
    logger.info(`${total}个用户修改成功！总共耗时${end - start}秒。`);
  };

  const getParentId = async (
    pid: string | null,
    thirdRootId: string | null,
  ) => {
    let parentId;
    if (pid === null || pid === thirdRootId) {
      parentId = await cloudOrgService.getRootDept();
    } else parentId = (await cloudOrgService.getDeptInfoByExId(pid)).dept_id;
    return parentId;
  };

  /**
   * 获取
   * @param fatherNode: 上级部门的Node，用于查找子节点中是否有重复账号（第三方）
   * @param department: 上级部门id（第三方）
   * @return 返回对应wps云文档的部门id
   */
  const realName = async (
    fatherNode: RemoteDeptInfo,
    department: RemoteDeptInfo,
  ) => {
    let depName = department.name;
    let num = 0;
    fatherNode.children.forEach((c) => {
      if (c.name === department.name) num += 1;
    });
    if (num > 1) {
      let deptIdWithoutPrefix = (department.deptId as string).replace(
        /^[xyj]/i,
        '',
      );
      // 如果 depName 的初始长度已经超过 50 个字符，需要进行截取
      if (depName.length + deptIdWithoutPrefix.length > 50) {
        // 保留的字符数
        depName = depName.slice(0, 42);
        deptIdWithoutPrefix = `${deptIdWithoutPrefix.slice(-5)}...`;
      }
      depName = `${depName}${deptIdWithoutPrefix}`;
    }
    depName = depName.replace(/[/,|]/g, config.step);
    if (depName.length > 50) {
      depName = `${depName.slice(0, 47)}...`;
    }
    return depName;
  };

  /**
   * 根据第三方部门的信息新增部门
   * @param fatherNode: 上级第三方部门的node信息，用于查找是否存在重复部门
   * @param department: 第三方部门信息
   * @param order: 顺序号
   * @return 同步数据库信息
   */
  const addDept = async (
    fatherNode: RemoteDeptInfo,
    department: RemoteDeptInfo,
    order: number = 999,
  ) => {
    const thirdDeptPid = department.deptPid;
    const depName = await realName(fatherNode, department);
    logger.info('*********新建部门************');
    try {
      const parentId = await getParentId(thirdDeptPid!, remoteService.rootId);
      const wpsDeptId = await cloudOrgService.creatDepts({
        name: depName,
        deptPid: parentId,
        order,
        exDeptId: department.deptId,
      });
      await localDeptsService.addDept({
        deptPid: thirdDeptPid,
        deptId: department.deptId,
        name: depName,
        wpsDeptPid: parentId,
        wpsDeptId,
      });

      logger.info(
        `创建部门:${depName},云文档部门Id：${wpsDeptId},type:${department.deptType},第三方部门ID：${department.deptId}，第三方ID父部门Id：${department.deptPid}成功！`,
      );

      if (department.children) {
        await asyncPool(
          1,
          department.children.map(
            (dept, index) => async () => addDept(department, dept, index),
          ),
        );
      }
    } catch (e: any) {
      const message = `部门名称${depName},ID:${department.deptId},type:${department.deptType},父ID：${department.deptPid}`;
      await errorService.catchLog(message, e);
    }
  };

  /**
   * 修改部门信息
   * @param fatherNode: 第三方父部门节点
   * @param oldDept: wps云文档部门节点
   * @param newDept: 第三方部门节点，待修改的部门信息
   */
  const editDept = async (
    fatherNode: RemoteDeptInfo,
    oldDept: RemoteDeptInfo,
    newDept: RemoteDeptInfo,
  ) => {
    try {
      if (oldDept.deptId === newDept.deptId) {
        const deptId = oldDept.wpsDeptId;
        const depName = await realName(fatherNode, newDept);
        const oldOrder = oldDept.order;

        if (deptId && depName !== oldDept.name) {
          try {
            await cloudOrgService.updateDepts(deptId, {
              name: depName,
            });
            logger.info(
              `修改部门名称${oldDept.name}为${depName},云文档部门Id：${deptId},第三方部门ID：${oldDept.deptId}成功！`,
            );
          } catch (e: any) {
            if (
              e.response &&
              e.response.data.result &&
              e.response.data.result === 10401012
            ) {
              await cloudOrgService.updateDepts(deptId, {
                name: `${depName}os`,
              });
              logger.info(
                `修改部门名称${oldDept.name}为${depName}os,云文档部门Id：${deptId},第三方部门ID：${oldDept.deptId}成功！`,
              );
            }
          }
        }
        if (
          deptId &&
          newDept.order &&
          Number(newDept.order) !== Number(oldOrder)
        ) {
          await cloudOrgService.updateDepts(deptId, {
            order: Number(newDept.order),
          });
          logger.info(
            `修改部门顺序${oldOrder}为${newDept.order},云文档部门Id：${deptId},第三方部门ID：${oldDept.deptId}成功！`,
          );
        }
      } else
        logger.warn(
          `修改部门名称${oldDept.name}失败,原部门Id${oldDept.deptId}和新部门id${newDept.deptId}不一致`,
        );
    } catch (e: any) {
      const message = `修改部门名称${oldDept.name}为${newDept.name}`;
      await errorService.catchLog(message, e);
    }
  };

  /**
   * 递归删除删除部门节点
   * @param restDept: 待删除的部门节点
   */
  const deleteDept = async (restDept: RemoteDeptInfo) => {
    try {
      const { children, wpsDeptId, name, deptId } = restDept;
      if (!wpsDeptId) {
        logger.info(`${name}的云文档id不存在！`);
        return;
      }
      await asyncPool(
        1,
        children.map((child) => async () => deleteDept(child)),
      );
      const users = await cloudUserService.getUsersInDept(wpsDeptId);
      const userIds = users.map((user: any) => user.company_uid);
      await sleep(50);
      //   删除部门并移除部门下的所有用户
      const result = await cloudOrgService.deleteDepts(wpsDeptId, userIds);
      await localDeptsService.deleteDept(deptId!);
      logger.info(`从云文档删除部门${name}结果${result}`);
    } catch (e: any) {
      const message = `删除部门名称${restDept.name},部门id${restDept.deptId}`;
      await errorService.catchLog(message, e);
    }
  };

  const readAllDepts = async () => {
    logger.info('从wps云文档读取部门数据中......');
    const start = dayjs().unix();
    const root = await cloudOrgService.getRootDept();
    let depResps = await cloudOrgService.getChildDepts(root, true);
    depResps = depResps.filter((d) => d.ex_dept_id);
    const deptNode = buildDeptTree(root, depResps, (row: any) => ({
      name: row.name,
      wpsDeptPid: row.dept_pid,
      wpsDeptId: row.dept_id,
      deptType: 0,
      deptId: row.dept_id,
      deptPid: row.dept_pid,
      order: row.order,
      children: [],
    })) || { children: [] };

    const bindExid = (childs: RemoteDeptInfo[]) => {
      for (const info of childs) {
        info.deptId = depResps.find(
          (dept) => dept.dept_id === info.deptId,
        )?.ex_dept_id;
        info.deptPid =
          depResps.find((dept) => dept.dept_id === info.deptPid)?.ex_dept_id ||
          '';
        bindExid(info.children);
      }
    };
    bindExid(deptNode.children);
    // const deptNode = await cloudOrgService.readAllDeptRecursion();
    const end = dayjs().unix();
    logger.info(`从wps云文档读取所有部门耗时${end - start}s`);
    return deptNode as RemoteDeptInfo;
  };

  const deleteUser = async (id: string) => {
    const userInfos = await cloudUserService.getUserInfos([id]);
    try {
      for (const userInfo of userInfos) {
        for (const dept of userInfo.depts) {
          if (dept.id) {
            await cloudUserService.removeUserFromDept(
              userInfo.company_uid,
              dept.id,
            );
            logger.info(`用户${userInfo.name}从部门${dept.name}移除成功！`);
          }
        }
        await cloudUserService.deleteUser(userInfo.company_uid);
        logger.info(
          `用户${userInfo.name}，id:${userInfo.company_uid},第三方id：${userInfo.third_union_id}移除成功！`,
        );
      }
    } catch (e) {
      const message = `删除用户${id}失败`;
      await errorService.catchLog(message, e);
    }
  };

  return {
    init,
    close,
    activateUser,
    readAllUsers,
    addUsers,
    addUser,
    editUsers,
    addDept,
    deleteDept,
    editDept,
    readAllDepts,
    cloudOrgService,
    deleteUser,
    cloudUserService,
    tokenService,
    spacesService,
    groupsService,
    calendarService,
    syncDepartmentOfUser,
  };
};
