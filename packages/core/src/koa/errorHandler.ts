import process from 'node:process';
import { type ParameterizedContext, type Next } from 'koa';
import status from 'statuses';
import { HttpException, isHttpExceptions } from './httpException';

export type ErrorHandler = (
  err: HttpException,
  ctx: ParameterizedContext,
) => void;
const defaultFormat = (ctx: ParameterizedContext, err: HttpException) => {
  switch (ctx.accepts('json', 'text')) {
    case 'json':
      ctx.type = 'application/json';
      // ctx.type 是 response.type 的别名， 用于设置响应头 Content-Type
      ctx.body = {
        code: ctx.status,
        message: err.message,
        ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
      };
      break;
    case 'text':
      ctx.type = 'text/plain';
      ctx.body = err.message;
      break;
    default:
      ctx.throw(406, 'json, html, or text only');
  }
};

export const errorHandler: ErrorHandler = (err, ctx) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(ctx.body);
    console.log(err);
  }
};

export const catchError =
  (format: typeof defaultFormat) =>
  async (ctx: ParameterizedContext, next: Next) => {
    let error;
    let formatFun = format;
    try {
      await next();
      let httpStatus = ctx.status;
      if (status(httpStatus) === undefined) {
        httpStatus = 500;
      }
      if (httpStatus >= 400 && httpStatus < 600) {
        error = new HttpException(ctx.status, ctx.body);
      }
    } catch (e: any) {
      error = e;
      if (!isHttpExceptions(e)) {
        error = new HttpException(500, e);
      }
    }
    if (!format || typeof format !== 'function') {
      formatFun = defaultFormat;
    }
    if (error) {
      formatFun(ctx, error);
      ctx.app.emit('error', error, ctx);
    }
  };
