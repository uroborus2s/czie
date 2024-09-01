import path from 'node:path';
import https from 'node:https';
import { type SecureContextOptions } from 'tls';
import Router from '@koa/router';
import Koa, { type Middleware } from 'koa';
import { type Options } from 'koa-sslify';
import { type Options as StaticOptions } from 'koa-static';
import { type CompressOptions } from 'koa-compress';
import compose from 'koa-compose';
import type { Logger } from 'winston';
import dayjs from 'dayjs';
import helmet from 'koa-helmet';
import { sleep } from '../util/utils';
import {
  type ErrorHandler,
  errorHandler as defaultErrorHandler,
} from './errorHandler';

type Transporter = (
  str: string,
  args: [
    string,
    string,
    string,
    number | undefined,
    string | undefined,
    string | undefined,
  ],
) => void;

interface TransporterOpts {
  transporter: Transporter;
}

type BodyType = 'json' | 'form' | 'text' | 'xml';
type BodyParserOptions = {
  parsedMethods?: string[];
  patchNode?: boolean;
  detectJSON?: (ctx: Koa.Context) => boolean;
  onError?: (error: Error, ctx: Koa.Context) => void;
  enableRawChecking?: boolean;
  enableTypes?: Array<BodyType>;
  extendTypes?: {
    [K in BodyType]?: string[];
  };
};

export interface KoaAppOptions {
  // 自定义koa中间键
  middlewares?: Array<(koaOptions: KoaAppOptions) => Middleware>;
  httpPort: number;
  // 启用服务端口
  koaPort: number;
  // 启用服务host
  koaHostname?: string;
  koaHttpsPort?: number | boolean;
  createHttpsOption?: () => SecureContextOptions;
  koaHttpsOptions?: SecureContextOptions;
  koaAutoHttpsRedirect?: Options;
  bodyParserOptions?: boolean | BodyParserOptions;
  koaStaticServer?: string;
  koaStaticOptions?: StaticOptions;
  koaNoGzip?: boolean | CompressOptions;
  koaNoCors?: boolean;
  koaLoggerOptions?: boolean | Transporter | TransporterOpts;
  koaReadOnly?: boolean;
  koaDelay?: number;
  koaUseragent?: boolean;
  errorHandler?: ErrorHandler;
  routers?: Array<Router>;
}

export default async (logger: Logger, koaAppOptions: KoaAppOptions) => {
  const localKoaAppOptions = koaAppOptions || {};
  const {
    httpPort,
    middlewares,
    koaPort,
    koaHostname,
    koaHttpsPort,
    bodyParserOptions,
    koaStaticServer,
    koaStaticOptions,
    koaHttpsOptions,
    koaAutoHttpsRedirect,
    koaNoGzip,
    koaNoCors,
    koaUseragent,
    koaLoggerOptions,
    koaReadOnly,
    koaDelay,
    errorHandler,
    routers,
  } = localKoaAppOptions;
  const app = new Koa();
  // app.use(catchError);
  if (bodyParserOptions !== false) {
    const bodyParser = await import('@koa/bodyparser');
    app.use(
      bodyParser.bodyParser(
        typeof bodyParserOptions === 'object' ? bodyParserOptions : undefined,
      ),
    );
  }

  const koaLogger = await import('koa-logger');
  let loggerOptions;
  if (koaLoggerOptions === false) {
    loggerOptions = undefined;
  } else if (
    typeof koaLoggerOptions === 'object' ||
    typeof koaLoggerOptions === 'function'
  ) {
    loggerOptions = koaLoggerOptions;
  } else {
    loggerOptions = (str: string) =>
      console.log(`${dayjs().format('YYYY-MM-DD HH:mm:ss')} ${str}`);
  }
  app.use(koaLogger.default(loggerOptions));
  app.use(helmet());

  if (koaStaticServer) {
    const serve = await import('koa-static');
    app.use(
      serve.default(path.join(koaStaticServer, './public'), koaStaticOptions),
    );
  }

  if (koaNoGzip !== true) {
    const compress = await import('koa-compress');
    app.use(
      compress.default(typeof koaNoGzip === 'object' ? koaNoGzip : undefined),
    );
  }
  if (koaNoCors !== true) {
    const cors = await import('@koa/cors');
    app.use(
      cors.default(typeof koaNoCors === 'object' ? koaNoCors : undefined),
    );
  }

  if (koaReadOnly) {
    app.use((ctx, next) => {
      if (ctx.method === 'GET') {
        next(); // Continue
      } else {
        ctx.throw(403); // Forbidden
      }
    });
  }

  if (koaDelay) {
    app.use(async (ctx, next) => {
      await sleep(koaDelay);
      await next();
    });
  }
  if (koaUseragent) {
    const useragent = await import('koa-useragent');
    app.use(useragent.userAgent);
  }

  if (middlewares && middlewares.length > 0)
    app.use(
      compose(middlewares.map((middleware) => middleware(localKoaAppOptions))),
    );

  if (routers) {
    routers.forEach((router) => app.use(router.routes()));
  }

  app.on('error', errorHandler || defaultErrorHandler);

  app.listen(httpPort, () =>
    logger.info(`http server is starting at port ${httpPort}`),
  );

  if (koaHttpsPort && koaHttpsOptions) {
    const mod = await import('koa-sslify');
    const sslify = mod.default.default;
    app.use(
      sslify(
        typeof koaAutoHttpsRedirect === 'object'
          ? koaAutoHttpsRedirect
          : undefined,
      ),
    );
    const httpsPort = typeof koaHttpsPort === 'number' ? koaHttpsPort : koaPort;
    https
      .createServer(koaHttpsOptions, app.callback())
      .listen(httpsPort, koaHostname, () =>
        logger.info(
          `https server is starting at port ${httpsPort},hostname:${koaHostname}`,
        ),
      );
  }
};
