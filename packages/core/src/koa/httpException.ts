// eslint-disable-next-line max-classes-per-file
import status from 'statuses';
import deprecate from 'depd';
import { toIdentifier } from '../util/utils';

export class HttpException extends Error {
  private readonly code;

  private readonly msg;

  public readonly statusCode;

  public readonly data: unknown;

  constructor(code = 500, ...args: any[]) {
    super(status(code));
    this.name = toIdentifier(status(code));
    this.statusCode = code;

    for (const arg of args) {
      const type = typeof arg;
      if (type === 'object' && arg instanceof Error) {
        const { message, name, stack, ...rest } = arg;
        this.message = message;
        this.name = name;
        this.stack = stack;
        if (this.data) {
          this.data = { ...this.data, ...rest };
        } else this.data = rest;
      } else if (type === 'string') {
        this.msg = arg;
      } else if (type === 'object' && arg !== null) {
        if (this.data) this.data = { ...this.data, ...arg };
        else this.data = arg;
      } else if (type === 'number') {
        this.code = arg;
      } else if (type === 'undefined') {
        /* empty */
      } else {
        throw new TypeError(`argument ${arg} unsupported type ${type}`);
      }
    }

    if (
      typeof this.statusCode === 'number' &&
      (this.statusCode < 400 || this.statusCode >= 600)
    ) {
      deprecate('non-error status code; use only 4xx or 5xx status codes');
    }
    Error.captureStackTrace(this, this.constructor);
  }

  throw() {
    throw this;
  }
}

export class ParameterError extends HttpException {
  constructor(...args: any[]) {
    super(400, 100400, '请求错误', ...args);
  }
}

export class UnauthorizedError extends HttpException {
  constructor(...args: any[]) {
    super(401, 100401, '校验失败', ...args);
  }
}

export class ForbiddenError extends HttpException {
  constructor(...args: any[]) {
    super(403, 100403, '禁止访问', ...args);
  }
}

export class NotFoundError extends HttpException {
  constructor(...args: any[]) {
    super(404, 100404, '请求的资源不存在', ...args);
  }
}

export class MethodNotAllowedError extends HttpException {
  constructor(...args: any[]) {
    super(405, 100405, '请求中的方法被禁止', ...args);
  }
}

export class NotAcceptableError extends HttpException {
  constructor(...args: any[]) {
    super(406, 100406, '无法完成请求', ...args);
  }
}

export class ProxyAuthError extends HttpException {
  constructor(...args: any[]) {
    super(407, 100407, '代理要求进行身份认证', ...args);
  }
}

export class RequestTimeoutError extends HttpException {
  constructor(...args: any[]) {
    super(408, 100408, '请求时间过长，超时', ...args);
  }
}

export class ConflictError extends HttpException {
  constructor(...args: any[]) {
    super(409, 100409, '服务器处理请求时发生了冲突', ...args);
  }
}

export class GoneError extends HttpException {
  constructor(...args: any[]) {
    super(410, 100410, '客户端请求的资源已经不存在', ...args);
  }
}

export class PayloadTooLargeError extends HttpException {
  constructor(...args: any[]) {
    super(413, 100413, '请求的实体过大', ...args);
  }
}

export class URIToLongError extends HttpException {
  constructor(...args: any[]) {
    super(414, 100414, '请求的URI过长', ...args);
  }
}

export class UnprocessableError extends HttpException {
  constructor(...args: any[]) {
    super(422, 100414, '服务器不可访问', ...args);
  }
}

export class LockedError extends HttpException {
  constructor(...args: any[]) {
    super(423, 100423, '服务器被锁', ...args);
  }
}

export class InternalServerError extends HttpException {
  constructor(...args: any[]) {
    super(500, 100500, '服务器内部错误，无法完成请求', ...args);
  }
}

export class NotImplementedError extends HttpException {
  constructor(...args: any[]) {
    super(501, 100501, '服务器不支持请求的功能，无法完成请求', ...args);
  }
}

export class BadGatewayError extends HttpException {
  constructor(...args: any[]) {
    super(502, 100502, '无效的网关', ...args);
  }
}

export class GatewayTimeoutError extends HttpException {
  constructor(...args: any[]) {
    super(504, 100504, '网关超时', ...args);
  }
}

export const isHttpExceptions = (exception: any) => {
  if (!exception || typeof exception !== 'object') {
    return false;
  }

  if (exception instanceof HttpException) {
    return true;
  }

  return (
    typeof exception.statusCode === 'number' &&
    typeof exception.code === 'number' &&
    exception instanceof Error
  );
};
