import type { RemoteDeptBaseInfo, RemoteDeptInfo } from '@wps/types-context';

export interface EquityOptions {
  teacher?: string;
  student?: string;
}

export const equity = (options: EquityOptions = {}) => {
  const teacherDeptId = options.teacher || 'wps-teacher-001';
  const studentDeptId = options.student || 'wps-studer-001';

  const equityDept = (rootId: string, children: RemoteDeptInfo[]) =>
    children.push(
      {
        deptPid: rootId,
        deptId: teacherDeptId,
        name: '教职工',
        order: 0,
        deptType: 0,
        children: [],
      },
      {
        deptPid: rootId,
        deptId: studentDeptId,
        name: '学生',
        order: 0,
        deptType: 0,
        children: [],
      },
    );

  const addVirtualDept = (rootId: string, children: RemoteDeptBaseInfo[]) =>
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

  const createUserDepts = (
    type: 'tea' | 'stu',
    returnDeptItems: () => { thirdDeptId: string; id: string; name: string }[],
  ) => {
    const depts = [
      {
        thirdDeptId: type === 'tea' ? teacherDeptId : studentDeptId,
        id: '',
        name: '',
      },
    ];

    depts.push(...returnDeptItems());

    return depts;
  };

  return { equityDept, createUserDepts, addVirtualDept };
};
