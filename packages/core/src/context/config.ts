import path from 'node:path';
import process from 'node:process';
import * as dotenv from 'dotenv';
import type { BaseConfig } from '@wps/types-context';
import { KSCIMConfig } from '@wps/types-context';

export const createBaseConfig = (dirPath: string): BaseConfig => {
  const devPath =
    process.env.NODE_ENV === 'development'
      ? `${path.join(dirPath, '.env.local')}`
      : `${path.join(dirPath, '.env')}`;
  dotenv.config({ path: devPath });

  return {
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : 8000,
    appid: process.env.APPID || '',
    appkey: process.env.APPKEY || '',
    wpsCloudUrl: process.env.WPS_URL || 'https://openapi.wps.cn',
    casServer: process.env.CAS_SERVICE || '',
    casValidate: process.env.CAS_VALIDATE || '',
    localUrl: process.env.LOCAL_URL || '',
    ssoAppId: process.env.SSO_APP_ID || '',
    redisUrl: process.env.REDIS_URL || '',
    axios: {
      timeout: 5000,
    },
    step: process.env.STEP || '-',
  };
};

export const createKSCIMConfig = (dirPath: string): KSCIMConfig => ({
  ...createBaseConfig(dirPath),
  KSCIMToken: process.env.KSCIM_TOKEN || 'default_wps_scim_token_1910',
  KSCIMDeptRootId: process.env.KSCIM_DEPT_ROOT_ID || '0',
});
