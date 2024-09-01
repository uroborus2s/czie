// eslint-disable-next-line max-classes-per-file
import { type ParameterizedContext } from 'koa';
import status from 'statuses';
import { toIdentifier } from '../util/utils';
import { isURL } from '../util/is';

export abstract class HttpSuccess {
  private readonly code;

  private readonly msg;

  public readonly statusCode;

  public readonly body: unknown;

  private readonly name: string;

  private readonly message: string;

  protected constructor(code = 200, ...args: any[]) {
    this.statusCode = code;
    this.message = status(code);
    this.name = toIdentifier(status(code));

    for (const arg of args) {
      const type = typeof arg;
      if (type === 'string') {
        if (isURL(arg)) {
          this.body = arg;
        } else this.msg = arg;
      } else if (type === 'object' && arg !== null) {
        if (this.body && typeof this.body === 'object')
          this.body = { ...this.body, ...arg };
        else if (this.body === undefined) {
          this.body = arg;
        }
      } else if (type === 'number') {
        this.code = arg;
      } else if (type === 'undefined') {
        /* empty */
      } else {
        throw new TypeError(`argument ${arg} unsupported type ${type}`);
      }
    }
  }

  ok(ctx: ParameterizedContext) {
    ctx.status = this.statusCode;
    ctx.body = this.body;
  }
}

export class Ok extends HttpSuccess {
  constructor(...args: any[]) {
    super(200, '请求已成功!', ...args);
  }
}

export class Created extends HttpSuccess {
  constructor(...args: any[]) {
    super(201, '该请求已成功,并因此创建了一个新的资源!', ...args);
  }
}

export class Accepted extends HttpSuccess {
  constructor(...args: any[]) {
    super(202, '请求已经接收到，但还未响应，没有结果。', ...args);
  }
}

export class MovedPermanently extends HttpSuccess {
  constructor(...args: any[]) {
    super(301, '请求资源的 URL 已永久更改。', ...args);
  }

  ok(ctx: ParameterizedContext) {
    ctx.status = this.statusCode;
    ctx.redirect(this.body as string);
  }
}

export class Found extends HttpSuccess {
  constructor(...args: any[]) {
    super(302, '此响应代码表示所请求资源的 URI 已 暂时 更改!', ...args);
  }

  ok(ctx: ParameterizedContext) {
    ctx.status = this.statusCode;
    ctx.redirect(this.body as string);
  }
}
