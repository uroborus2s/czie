import crypto from 'node:crypto';
import axios from 'axios';
import * as xml from 'xml2js';
import { RedisClientType, RedisClusterType } from 'redis';
import winston from 'winston';
import Router from '@koa/router';
import type { BaseConfig } from '@wps/types-context';
import { type InterceptorApi } from './applyMiddleware';

export const casMiddleRoutes =
  (casLogin: OauthByCas<any>) => (interceptor: InterceptorApi) => {
    interceptor.router((router: Router) => {
      router.get('/authorize', (ctx: any) => casLogin.authorize(ctx));

      router.get('/accessToken', (ctx: any) => casLogin.accessToken(ctx));

      router.get('/userInfo', (ctx: any) => casLogin.userInfo(ctx));

      router.get('/', (ctx: any) => casLogin.goHome(ctx));

      return router;
    });
  };

export interface OauthByCasOptions<Config extends BaseConfig> {
  config: Config;
  redisClient: RedisClientType | RedisClusterType;
  logger: winston.Logger;
  cookieOptions?: Record<string, any>;
}

export abstract class OauthByCas<Config extends BaseConfig = BaseConfig> {
  protected config: Config;

  protected redisClient: RedisClientType | RedisClusterType;

  protected logger: winston.Logger;

  protected readonly cookieOptions = {
    maxAge: 5 * 60 * 1000,
    // domain: '.gpnu.edu.cn',
  };

  protected readonly prefixCode = 'cas-';

  constructor(options: OauthByCasOptions<Config>) {
    this.config = options.config;
    this.redisClient = options.redisClient;
    this.logger = options.logger;
    if (options.cookieOptions)
      this.cookieOptions = { ...this.cookieOptions, ...options.cookieOptions };
  }

  async authorize(ctx: any) {
    this.logger.info(`授权应用开始，请求 ${ctx.request.href}`);
    const { redirect_url: redirectUrl, state, ticket } = ctx.query;
    try {
      if (ticket) {
        await this.casValidate(ctx);
      } else if (redirectUrl && state) {
        await this.goCasLogin(ctx);
      }
    } catch (e: any) {
      this.logger.info(JSON.stringify(e));
      let resp = e;
      ctx.status = 400;
      if (e.response) resp = e.response.data;
      ctx.body = { resp };
    }
  }

  async accessToken(ctx: any) {
    const { code, grant_type: grantType } = ctx.query;
    if (code && grantType === 'authorization_code') {
      ctx.body = { access_token: code, expires_in: 3600 };
      ctx.status = 200;
    } else ctx.status = 403;
  }

  async userInfo(ctx: any) {
    const { access_token: accessToken } = ctx.query;
    let userId: string | null | undefined;
    let username;
    try {
      const { userId: casUid, username: casUserName } =
        await this.getCasLoginInfo(accessToken);
      userId = casUid;
      username = decodeURIComponent(casUserName);
      this.logger.info(`用户姓名${username}，ID：${userId},请求登录！`);
      if (userId && username) {
        ctx.status = 200;
        ctx.body = {
          union_id: userId,
          user_name: username,
          avatar: '',
        };
      } else {
        ctx.status = 401;
      }
    } catch (e: any) {
      ctx.status = 400;
      ctx.body = { e };
      let msg = '';
      if (e.response) {
        msg = `错误状态：${e.response.status},result:${e.response.data.result},msg:${e.response.data.msg}`;
      }
      this.logger.info(msg);
    }
  }

  async goHome(ctx: any) {
    ctx.status = 302;
    ctx.redirect(
      `https://open.wps.cn/oauth/v1/auth?app_id=${this.config.ssoAppId}&cb=https%3A%2F%2Fkdocs.cn`,
    );
  }

  async logout(ctx: any) {
    ctx.status = 302;
    ctx.redirect(
      `${this.config.casServer}/logout?service=${encodeURIComponent(
        this.config.localUrl,
      )}`,
    );
  }

  abstract saveCasLogin(key: any, attribute: any): Promise<any>;

  abstract getCasLoginInfo(accessToken: any): Promise<Record<string, string>>;

  uuidKey(ticket: string) {
    const code = crypto.randomUUID();
    return `${this.prefixCode}${ticket.slice(0, 6)}-${code}`;
  }

  async goCasLogin(ctx: any) {
    const { redirect_url: redirectUrl, state } = ctx.query;
    if (redirectUrl && state) {
      const url = this.getCasLoginUrl(state);
      await this.setState(ctx);
      ctx.status = 302;
      ctx.redirect(`${this.config.casServer}/login?service=${url}`);
    } else {
      ctx.status = 400;
      ctx.body = {
        code: 400,
        msg: 'error request！',
      };
    }
  }

  protected async getRedirectUrl(ctx: any) {
    const { state } = ctx.query;
    let redirectUrl;
    if (state) redirectUrl = await this.redisClient.get(state);
    else redirectUrl = ctx.cookies.get('redirect_url');
    return redirectUrl;
  }

  // 返回state
  protected getState(ctx: any) {
    let { state } = ctx.query;
    if (!state) {
      state = ctx.cookies.get('state');
    }
    return state;
  }

  protected async setState(ctx: any) {
    const { redirect_url: redirectUrl, state } = ctx.query;
    if (redirectUrl && state) {
      // 设置cookie
      ctx.cookies.set('redirect_url', redirectUrl, this.cookieOptions);
      ctx.cookies.set('state', state, this.cookieOptions);
      // 保存到redis中
      await this.redisClient.set(state, redirectUrl);
      await this.redisClient.expire(state, 300 as any);
    }
  }

  getCasLoginUrl(state: any) {
    let url = this.config.localUrl;
    if (state) url = `${url}?state=${state}`;
    return encodeURIComponent(url);
  }

  getCasValidateUrl(state: any) {
    return this.getCasLoginUrl(state);
  }

  getCasUser(successData: any) {
    let user;
    if (Array.isArray(successData) && successData[0]) {
      const { 'cas:user': casUsers } = successData[0];
      user = Array.isArray(casUsers) ? casUsers[0] : undefined;
    }
    return (user as string).trim();
  }

  getCasAttribute(successData: any) {
    let attribute;
    if (Array.isArray(successData) && successData[0]) {
      const { 'cas:attributes': attributes } = successData[0];
      attribute = Array.isArray(attributes) ? attributes[0] : undefined;
    }
    return attribute;
  }

  getCasAuthentication(response: any) {
    const {
      'cas:serviceResponse': {
        'cas:authenticationSuccess': authenticationSuccess,
        'cas:authenticationFailure': authenticationFailure,
      },
    } = response;
    return { authenticationSuccess, authenticationFailure };
  }

  protected parseCasResponse(response: any) {
    const { authenticationFailure, authenticationSuccess } =
      this.getCasAuthentication(response);
    if (process.env.DEBUG === 'TRUE') {
      if (authenticationFailure) {
        this.logger.info(JSON.stringify(authenticationFailure));
      } else {
        this.logger.info(JSON.stringify(authenticationSuccess));
      }
    }
    const error = Array.isArray(authenticationFailure)
      ? authenticationFailure[0]
      : undefined;
    const user = this.getCasUser(authenticationSuccess);
    const attribute = this.getCasAttribute(authenticationSuccess);
    return { error, user, attribute };
  }

  casRedirectUri(rUrl: string, code: string, state: string) {
    return `${rUrl}&code=${code}&state=${state}`;
  }

  async casValidate(ctx: any) {
    const { ticket, state: qState } = ctx.query;
    if (ticket) {
      const url = this.getCasValidateUrl(qState);
      const validate = this.config.casValidate || 'serviceValidate';
      this.logger.info(
        `请求cas平台校验token,请求url：${this.config.casServer}/${validate}?ticket=${ticket}&service=${url}`,
      );
      const res = await axios.get(
        `${this.config.casServer}/${validate}?ticket=${ticket}&service=${url}`,
      );
      if (process.env.DEBUG === 'TRUE') {
        this.logger.info(`返回的的状态信息：${res.status}`);
        if (res.data) {
          this.logger.info(JSON.stringify(res.data));
        }
      }
      const { status, data } = res;
      if (status === 200) {
        const xmlRes = await xml.parseStringPromise(data);
        const { error, user, attribute } = this.parseCasResponse(xmlRes);
        if (error) {
          ctx.status = 403;
          ctx.body = {
            reason: `cas platform verification failed:${error}`,
          };
          return;
        }
        const code = this.uuidKey(ticket);
        let reason = `cas user error:${user}`;
        if (user) {
          await this.redisClient.hSet(code, 'user' as any, user);
          if (attribute) await this.saveCasLogin(code, attribute);
          await this.redisClient.expire(code, 300 as any);
          const rUrl = await this.getRedirectUrl(ctx);
          if (rUrl) {
            const state = this.getState(ctx);
            if (state) {
              this.logger.info(
                `开始oauth2认证，回调地址:${rUrl},state:${state}`,
              );
              ctx.status = 302;
              ctx.redirect(this.casRedirectUri(rUrl, code, state));
              return;
            }
            reason = `state parameter error:${state}`;
          } else {
            reason = `service parameter error:${rUrl}`;
          }
        }
        ctx.status = 408;
        ctx.body = {
          reason,
        };
      } else {
        ctx.status = 403;
        ctx.body = {
          code: status,
          msg: 'No Access',
        };
      }
    } else {
      ctx.status = 400;
      ctx.body = {
        msg: 'error request',
      };
    }
  }
}
