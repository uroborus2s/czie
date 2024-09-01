import { type Middleware } from 'koa';
import { KoaAppOptions } from '../koa/createKoaApp';

// 强制重定向到 HTTPS 的中间件
export const onlyHttpsMiddle =
  (options: KoaAppOptions): Middleware =>
  async (ctx, next) => {
    if (options.koaHttpsPort && options.koaHttpsOptions && !ctx.secure) {
      // 如果是 HTTP，重定向到 HTTPS
      ctx.redirect(`https://${ctx.hostname}${ctx.url}`);
    } else {
      await next();
    }
  };
