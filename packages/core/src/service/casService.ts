import type { KSCIMConfig } from '@wps/types-context';
import Router from '@koa/router';
import { KScimService } from './kscimService';
import { OauthByCas } from '../sso/cas';

export const createCasRouter = (casOauth: OauthByCas): Router => {
  const router = new Router();

  router.get('/logout', (ctx: any) => casOauth.logout(ctx));

  router.get('/authorize', (ctx: any) => casOauth.authorize(ctx));

  router.get('/accessToken', (ctx: any) => casOauth.accessToken(ctx));

  router.get('/userInfo', (ctx: any) => casOauth.userInfo(ctx));

  router.get('/', (ctx: any) => casOauth.goHome(ctx));
  return router;
};

export const createKScimServiceRouter = <Config extends KSCIMConfig>(
  kScimService: KScimService<Config>,
): Router => {
  const router = createCasRouter(kScimService);

  router.get('/api/wps/getGroups', (ctx: any) =>
    kScimService.readAddressBooks(ctx, 'group'),
  );

  router.get('/api/wps/getUserInfos', (ctx: any) =>
    kScimService.readAddressBooks(ctx, 'user'),
  );

  return router;
};
