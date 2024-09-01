import { type Logger } from 'winston';

export const returnError = ({
  type,
  operation,
  name,
  id,
  message,
  error,
  logger,
}: {
  type: number;
  operation: number;
  name: string;
  id: string;
  message: string;
  error: any;
  logger: Logger;
}) => {
  let code = '-1';
  let msg = '未知原因';
  if (error.res) {
    code = error.res.result;
    msg = error.res.msg;
  } else if (error.response) {
    code = error.response.status;
    msg = `
    data:${JSON.stringify(error.response.data)}
    url:${JSON.stringify(error.response.config.url)}`;
  }
  logger.error(`${message},
  result:${code},
  msg:${msg}`);
};

export const axiosError = (error: any, logger: Logger) => {
  if (error.response) {
    // 请求成功发出且服务器也响应了状态码，但状态代码超出了 2xx 的范围
    logger.info(error.response.data);
    logger.info(error.response.status);
    logger.info(error.response.headers);
  } else if (error.request) {
    // 请求已经成功发起，但没有收到响应
    // `error.request` 在浏览器中是 XMLHttpRequest 的实例，
    // 而在node.js中是 http.ClientRequest 的实例
    logger.info(error.request);
  } else {
    // 发送请求时出了点问题
    logger.info('Error', error.message);
  }
};

export const errorLog = (error: unknown, message: string, logger: Logger) => {
  if (error instanceof Error) {
    axiosError(error, logger);
  } else {
    logger.info(message);
  }
};
