import { OauthByCas } from '@wps/core';

export class TemplateCas extends OauthByCas {
  async getCasLoginInfo(accessToken: any) {
    const { user: userId, username } =
      await this.redisClient.hGetAll(accessToken);
    return { userId, username };
  }

  async saveCasLogin(key: any, attribute: any) {
    this.logger.info(`cas平台返回的信息：${JSON.stringify(attribute)}`);
    const { 'cas:uid': names } = attribute;
    if (names && names[0])
      await this.redisClient.hSet(key, 'username' as any, names[0]);
  }
}
