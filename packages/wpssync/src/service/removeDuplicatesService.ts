import {
  ContextService,
  RemoteUserInfo,
  ServiceConstructor,
} from '@wps/types-context';
import { newService } from '@wps/core';
import dayjs from 'dayjs';

export interface RemoveDuplicatesService extends ContextService {
  removeUserInfos(remoteUserInfos: RemoteUserInfo[]): RemoteUserInfo[];
}

export const createRemoveDuplicatesService: ServiceConstructor = (
  serviceName,
  { logger },
) => {
  const removeDuplicates = (
    infos: any[],
    load: (t: any[], i: number, j: number) => boolean,
  ) => {
    for (let i = 0; i < infos.length; i += 1) {
      for (let j = i + 1; j < infos.length; j += 1) {
        const res = load(infos, i, j);
        if (res) {
          infos.splice(j, 1);
          j -= 1;
        }
      }
    }
  };

  const removeUserInfos = (remoteUserInfos: RemoteUserInfo[]) => {
    const removeStart = dayjs().unix();
    logger.info(`开始去重操作,去重前的用户数量${remoteUserInfos.length}`);
    removeDuplicates(remoteUserInfos, (infos, i, j) => {
      if (infos[i].userId === infos[j].userId) {
        const deptTemps = infos[i].depts;
        deptTemps.push(...infos[j].depts);
        removeDuplicates(deptTemps, (ds, n, m) => {
          if (ds[n].id && ds[m].id) {
            return ds[n].id === ds[m].id;
          }
          return ds[n].thirdDeptId === ds[m].thirdDeptId;
        });
        infos[i].depts = deptTemps;
        return true;
      }
      return false;
    });
    const removeEnd = dayjs().unix();
    logger.info(
      `去重操作耗时${removeEnd - removeStart}秒,去重之后的用户数量${
        remoteUserInfos.length
      }`,
    );
    return remoteUserInfos;
  };
  return { ...newService(), removeUserInfos };
};
