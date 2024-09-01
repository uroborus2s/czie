import Router from '@koa/router';
import type {
  BaseConfig,
  ContextService,
  ServiceConstructor,
} from '@wps/types-context';
import { AES, enc, MD5, mode, newService, pad, wpsHmacSHA256 } from '@wps/core';

// 使用jsonwebtoken库来解析和验证JWT

export type SubOperateFunc = (decryptString: {
  src?: Record<string, string> | Array<Record<string, string>>;
  dest?: Record<string, string> | Array<Record<string, string>>;
}) => Promise<void>;

export interface WpsSubscriptionOptions {
  companyCreate?: SubOperateFunc;
  companyUpdate?: SubOperateFunc;
  companyDelete?: SubOperateFunc;
  deptCreate?: SubOperateFunc;
  deptUpdate?: SubOperateFunc;
  deptDelete?: SubOperateFunc;
  memberCreate?: SubOperateFunc;
  memberUpdate?: SubOperateFunc;
  memberDelete?: SubOperateFunc;
  memberStatusUpdate?: SubOperateFunc;
  appOrgPermissionSettingUpdate?: SubOperateFunc;
}

export interface WpsSubscriptionService extends ContextService {
  createWpsSubscriptionRouter(subOptions?: WpsSubscriptionOptions): Router;
}

export const createWpsSubscriptionService: ServiceConstructor = (
  serviceName: string,
  options,
): WpsSubscriptionService => {
  const { logger } = options;
  const config = options.config as BaseConfig;
  logger.info(`创建${serviceName}对象`);

  const noop = () => Promise.resolve();

  // 解密函数
  const decrypt = (encryptedData: string, sk: string, nonce: string) => {
    const key = enc.Utf8.parse(sk);
    const iv = enc.Utf8.parse(nonce);

    const decrypted = AES.decrypt(encryptedData, key, {
      iv,
      mode: mode.CBC,
      padding: pad.Pkcs7,
    });

    return decrypted.toString(enc.Utf8);
  };

  const createWpsSubscriptionRouter = (subOptions?: WpsSubscriptionOptions) => {
    const funcOptions = subOptions || {};

    const funcMap: Record<string, Record<string, SubOperateFunc>> = {
      'wps.open.plus.company': {
        create: funcOptions.companyCreate || noop,
        update: funcOptions.companyUpdate || noop,
        delete: funcOptions.companyDelete || noop,
      },
      'wps.open.plus.dept': {
        create: funcOptions.deptCreate || noop,
        update: funcOptions.deptUpdate || noop,
        delete: funcOptions.deptDelete || noop,
      },
      'wps.open.plus.member': {
        create: funcOptions.memberCreate || noop,
        update: funcOptions.memberUpdate || noop,
        delete: funcOptions.memberDelete || noop,
      },
      'wps.open.plus.member.status': {
        update: funcOptions.memberStatusUpdate || noop,
      },
      'wps.open.plus.app.org_permission_setting': {
        update: funcOptions.appOrgPermissionSettingUpdate || noop,
      },
    };

    const subscriptionHandler = async (
      topic:
        | 'wps.open.plus.company'
        | 'wps.open.plus.dept'
        | 'wps.open.plus.member'
        | 'wps.open.plus.member.status'
        | 'wps.open.plus.app.org_permission_setting',
      operation: 'create' | 'update' | 'delete',
      businessData: string,
    ): Promise<string> => {
      const func = funcMap[topic][operation];
      if (!func) {
        throw new Error(`未找到${topic}的${operation}处理函数`);
      }
      await func(JSON.parse(businessData));
      return `订阅主题：${topic}，动作${operation}处理成功！`;
    };
    const subscription = async (ctx: any) => {
      if (ctx.method === 'POST') {
        const requestData = ctx.request.body;
        logger.info(
          `事件${requestData.topic}的订阅回调数据：${JSON.stringify(requestData.encrypted_data)}`,
        );
        const content = `${config.appid}:${requestData.topic}:${requestData.nonce}:${requestData.time}:${requestData.encrypted_data}`;
        const signature = wpsHmacSHA256(content, config.appkey)
          .toString(enc.Base64)
          .replace(/\+/g, '-') // 替换 '+'
          .replace(/\//g, '_')
          .replace(/=+$/, '');
        if (requestData.signature !== signature) {
          logger.error('签名无效');
          ctx.status = 400;
          ctx.body = 'Signature invalid';
          return;
        }
        const cipher = MD5(config.appkey).toString();

        try {
          const businessData = decrypt(
            requestData.encrypted_data,
            cipher,
            requestData.nonce,
          );
          const rMessage = await subscriptionHandler(
            requestData.topic,
            requestData.operation,
            businessData,
          );
          logger.info(rMessage);
          ctx.status = 200;
          ctx.body = {
            code: 'success',
            msg: rMessage,
          };
        } catch (error: any) {
          logger.error(`解密失败：${error.message}`);
          logger.error(`stack:${JSON.stringify(error.stack)}`);
          ctx.status = 500;
          ctx.body = `Decryption error: ${error.message}`;
        }
      } else {
        logger.warn('未找到订阅回调处理函数');
        ctx.status = 404;
        ctx.body = { message: 'Not Found' };
      }
    };

    const router = new Router();

    router.post('/wps/subscription/callback', subscription);

    return router;
  };
  return { ...newService(), createWpsSubscriptionRouter };
};
