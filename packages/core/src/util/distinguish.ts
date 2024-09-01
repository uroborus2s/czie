import { RemoteDeptBaseInfo } from '@wps/types-context';

export interface DistinguishOptions {
  teacher?: string;
  student?: string;
}

export interface DistinguishDept {
  // 第三方部门上级部门id
  deptPid?: string;
  // 第三方部门id
  deptId?: string;
  // 部门名称
  name: string;
  order?: number;
}

export interface DistinguishUser {
  userId: string;
  name: string;
  phone?: string;
  email?: string;
  title?: string;
  order?: string;
  employeeId?: string;
  // 0:学生；1:教师
  type: number;
  deptId: string;
}

export const distinguish = (options: DistinguishOptions = {}) => {
  const studentDeptId = options.student || 'wps-studer-001';

  const teacherDeptId = options.teacher || 'wps-teacher-001';

  const distinguishDept = (rootId: string, children: DistinguishDept[]) =>
    children.push(
      {
        deptPid: rootId,
        deptId: teacherDeptId,
        name: '教职工',
        order: 0,
      },
      {
        deptPid: rootId,
        deptId: studentDeptId,
        name: '学生',
        order: 0,
      },
    );

  const distinguishUsers = (users: DistinguishUser[]) => {
    const uniqueItemsMap = new Map(users.map((user) => [user.userId, user]));
    const uniqueItems = Array.from(uniqueItemsMap.values());

    const newUsers = uniqueItems.map((item) => ({
      ...item,
      deptId: item.type === 0 ? studentDeptId : teacherDeptId,
    }));
    users.push(...newUsers);
  };

  return { distinguishDept, distinguishUsers };
};
