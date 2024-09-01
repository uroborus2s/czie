import { type SqliteService } from '@wps/sqlite';
import type { ContextService, ServiceConstructor } from '@wps/types-context';
import dayjs from 'dayjs';
import axios from 'axios';
import { enc, MD5 } from '@wps/core';
import Router from '@koa/router';
import { Config } from './createConfig';

export interface SaveDBFromApiService extends ContextService {
  saveToDBFromApi: () => Promise<void>;
  createOauthRouter: () => Router;
}

export const createSaveDBFromApiService: ServiceConstructor = (
  serviceName,
  options,
): SaveDBFromApiService => {
  const { logger, getService } = options;
  logger.info(`创建${serviceName}对象`);
  const config = options.config as Config;
  const dbFile = config.localDbFile;
  const sqliteService = getService('sqliteService') as SqliteService;

  const init = async () => {};

  const axiosClient = axios.create({
    baseURL: `${config.apiUrl}/yunzhi-api/openapi`,
  });

  // 生成签名
  const sign = (base64Parameters: string, uri: string) => {
    const dataToSign = `${base64Parameters}${uri}${config.apiAppSecret}`;
    return MD5(dataToSign).toString(enc.Hex).toUpperCase();
  };
  // 生成 Token
  const generateToken = (uriStr: string) => {
    const parameters = JSON.stringify({
      alg: 'MD5',
      appKey: config.apiAppKey,
      timestamp: dayjs().valueOf().toString(),
    });

    const base64Parameters = Buffer.from(parameters).toString('base64');
    const signature = sign(base64Parameters, uriStr);

    return `${base64Parameters}.${signature}`;
  };

  // 发送 POST 请求
  async function readDataPre(uri: string, requestBody: any) {
    const headers = {
      version: '2.0.0',
      Authorization: generateToken(uri),
      'Content-Type': 'application/json',
    };

    try {
      const response = await axiosClient.post(uri, requestBody, {
        headers,
      });
      return response.data;
    } catch (error) {
      console.error(`url: ${uri} request error`, error);
      throw error;
    }
  }

  const close = async () => {};

  // 根据数据创建表
  const readDepartments = async (orgId: string) => {
    const departments = [];
    for (const type of ['EMPLOYEE', 'CUSTOMER']) {
      let pageNum = 1;
      while (true) {
        const deptReps = await readDataPre('/third/department/list', {
          workContext: {
            orgId,
          },
          deptGroup: type,
          pageNum,
          pageSize: 200,
        });
        pageNum += 1;
        departments.push(
          ...deptReps.data.map((dept: any) => ({ ...dept, orgId })),
        );
        if (deptReps.data.length < 200) {
          break;
        }
      }
    }
    return departments;
  };

  const mergeArraysByUserId = (key: string, arr1: any[], arr2: any[]) => {
    // 创建一个新的 Map，以 userId 作为键
    const map = new Map();

    // 遍历第一个数组，将对象存入 Map 中，userId 作为键
    arr1.forEach((item) => {
      map.set(item[key], { ...item });
    });

    // 遍历第二个数组，合并对象到 Map 中
    arr2.forEach((item) => {
      if (map.has(item[key])) {
        // 如果 Map 中已存在相同的 userId，合并对象
        map.set(item[key], { ...map.get(item[key]), ...item });
      } else {
        // 如果 Map 中没有该 userId，直接添加
        map.set(item[key], { ...item });
      }
    });

    // 将 Map 的值转换回数组
    return Array.from(map.values());
  };

  const fetchUsersByDeptIds = async (idArray: string[], orgId: string) => {
    const chunkSize = 200; // 每次请求的ID数量
    const totalChunks = Math.ceil(idArray.length / chunkSize); // 计算总共的请求次数
    const users = [];
    for (let i = 0; i < totalChunks; i += 1) {
      // 分割数组，每次取200个ID
      const deptIdList = idArray.slice(i * chunkSize, (i + 1) * chunkSize);

      try {
        const userRes = await readDataPre('/third/user/list', {
          workContext: {
            orgId,
          },
          deptIdList,
        });
        const userIds = userRes.data.map((user: any) => user.userId);
        const infos = await readDataPre('/third/user/get', {
          orgId,
          userIds,
        });
        users.push(...mergeArraysByUserId('userId', userRes.data, infos.data));
      } catch (error) {
        console.error('Error fetching users:', error);
        throw error;
      }
    }
    return users;
  };

  const readUsers = async (orgs: any[], departments: any[]) => {
    const users = [];
    for (const org of orgs) {
      const deptIds = departments.map((dept) => dept.deptId);
      const infos = await fetchUsersByDeptIds(deptIds, org.orgId);
      users.push(...infos);
    }
    return users;
  };

  const readOrgs = async (orgsString: string) => {
    // 从 .env 文件中获取 orgids，并将其拆分为数组
    const orgIds = orgsString?.split(',').map((id) => id.trim()) || [];
    const orgs = [];
    for (const orgId of orgIds) {
      const orgData = await readDataPre('/third/org/org-info', {
        orgId,
      });
      orgs.push(orgData);
    }
    return orgs;
  };

  const saveToDBFromApi = async () => {
    logger.info('*******开始从第三方用户库中同步数据********');
    const start = dayjs().unix();

    const sqlite = await sqliteService.getConnect(dbFile);
    const orgs = await readOrgs(config.orgIds);
    const depts = await readDepartments(config.orgIds);
    const users = await readUsers([orgs], depts);

    try {
      await sqlite.run('BEGIN TRANSACTION');
      await sqliteService.createAndInsertTable(sqlite, 'orgs', orgs, 'orgId');
      await sqliteService.createAndInsertTable(
        sqlite,
        'depts',
        depts,
        'deptId',
      );
      await sqliteService.createAndInsertTable(
        sqlite,
        'users',
        users,
        'userId',
      );
      await sqlite.run('COMMIT');
      const end = dayjs().unix();
      logger.info(`将所有数据写入本地数据库耗费时间${end - start}秒`);
    } catch (e) {
      logger.error(`Error during transaction:${JSON.stringify(e)}`);
      await sqlite.run('ROLLBACK');
    }
    const end = dayjs().unix();
    logger.info(`从接口读取数据并保存到本地数据库耗费时间${end - start}秒`);
  };

  const accessToken = async (ctx: any) => {
    const { code } = ctx.query;
    ctx.status = 200;
    ctx.body = { access_token: code, expires_in: 7200 };
  };

  const userInfo = async (ctx: any) => {
    const { access_token: code } = ctx.query;
    try {
      const userData = await readDataPre(
        `/third/auth/tob/getuserinfo?code=${code}&clientId=${config.oauthClientId}`,
        {},
      );
      logger.info(`用户${userData.userId}:${userData.name}请求登录！`);
      ctx.status = 200;
      ctx.body = {
        union_id: userData.userId,
        user_name: userData.name,
        avatar: '',
      };
    } catch (e: any) {
      logger.error(`message: ${e.message}`);
      ctx.status = 403;
      ctx.body = { message: '获取用户信息失败！' };
    }
  };

  const createOauthRouter = () => {
    const router = new Router();

    router.get('/oauth/accessToken', accessToken);
    router.get('/oauth/userInfo', userInfo);

    return router;
  };

  return {
    init,
    close,
    saveToDBFromApi,
    createOauthRouter,
  };
};
