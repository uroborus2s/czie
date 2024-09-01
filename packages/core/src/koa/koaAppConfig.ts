import { SecureContextOptions } from 'tls';
import { Options } from 'koa-sslify';
import { Options as StaticOptions } from 'koa-static';
import { CompressOptions } from 'koa-compress';

export interface KoaConfig {
  httpPort: number;
  // 启用服务端口
  koaPort: number;
  // 启用服务host
  koaHostname?: string;
  koaHttpsPort?: number | boolean;
  koaHttpsOptions?: SecureContextOptions;
  koaAutoHttpsRedirect?: Options;
  koaStaticServer?: string;
  koaStaticOptions?: StaticOptions;
  koaNoGzip?: boolean | CompressOptions;
  koaNoCors?: boolean;
  koaReadOnly?: boolean;
  koaDelay?: number;
  koaHttpsKeyPath?: string;
  koaHttpsCertPath?: string;
}

export const createKoaConfig = (): KoaConfig => ({
  httpPort: process.env.PORT ? parseInt(process.env.PORT, 10) : 80,
  koaPort: process.env.KOA_PORT ? parseInt(process.env.KOA_PORT, 10) : 8000,
  koaHttpsKeyPath: process.env.KOA_HTTPS_KEY_PATH,
  koaHttpsCertPath: process.env.KOA_HTTPS_CERT_PATH,
});
