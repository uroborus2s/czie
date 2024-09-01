import Router from '@koa/router';
import type { BaseConfig, Context } from '@wps/types-context';
import { InterceptorApi } from './applyMiddleware';

export const wpsRouterMiddleware =
  <Config extends BaseConfig>(context: Context<Config>) =>
  (interceptor: InterceptorApi) => {
    interceptor.router((router: Router) => {
      router.post('/wps_request', async (ctx: any) => {
        try {
          const { url } = ctx.query;
          // const config = ctx.body;
          // const buildUrl = (token: string) =>
          //   (url as string).includes('?')
          //     ? `${url}&company_token=${token}`
          //     : `${url}?company_token=${token}`;
          // await context.tokenService.wpsApiRequest(buildUrl, config);
        } catch (e) {
          console.log(e);
        }
      });
      return router;
    });
  };
