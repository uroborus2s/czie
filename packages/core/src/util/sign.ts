import { createHash, createHmac } from 'node:crypto';

import { type InternalAxiosRequestConfig } from 'axios';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);

export function WPS3Sign(
  request: InternalAxiosRequestConfig,
  apiId: string,
  apiKey: string,
) {
  const contentType = 'application/json';
  const sha1 = createHash('sha1');
  const md5 = createHash('md5');
  const body = request.data;
  if (body) {
    md5.update(JSON.stringify(body));
  } else {
    md5.update('');
  }
  const contentMd5 = md5.digest('hex');
  const { url } = request;
  const date = `${dayjs.utc().format('ddd, DD MMM YYYY HH:mm:ss')} GMT`;

  sha1.update(
    `${apiKey.toLowerCase()}${contentMd5}${url}${contentType}${date}`,
  );
  const xAuth = `WPS-3:${apiId}:${sha1.digest('hex')}`;

  if (request.headers) {
    request.headers['Content-Type'] = contentType;
    request.headers['Content-Md5'] = contentMd5;
    request.headers.Date = date;
    request.headers['X-Auth'] = xAuth;
  }
  return request;
}

export const md5Base64 = (inputString: string) => {
  const hash = createHash('md5').update(inputString, 'utf-8').digest('hex');
  return Buffer.from(hash).toString('base64');
};

function getKso1Signature(
  method: string,
  uri: string,
  ksoDate: string,
  contentType: string,
  requestBody: string,
  secretKey: string,
) {
  let sha256Hex = '';

  if (requestBody && requestBody.length > 0) {
    sha256Hex = createHash('sha256').update(requestBody, 'utf8').digest('hex');
  }

  const stringToSign = `KSO-1${method}${uri}${contentType}${ksoDate}${sha256Hex}`;
  return createHmac('sha256', secretKey)
    .update(stringToSign, 'utf8')
    .digest('hex');
}

export function KSOSign_V1(
  request: InternalAxiosRequestConfig,
  apiId: string,
  apiKey: string,
) {
  const contentType =
    request.headers['content-type'] ||
    request.headers['Content-Type'] ||
    'application/json';
  const body = request.data ? JSON.stringify(request.data) : '';
  const method = request.method?.toUpperCase() || 'POST';
  const uri = request.url || '';

  const date = `${dayjs.utc().format('ddd, DD MMM YYYY HH:mm:ss')} GMT`;

  const ksoSignature = getKso1Signature(
    method,
    uri,
    date,
    contentType,
    body,
    apiKey,
  );
  const authorization = `KSO-1 ${apiId}:${ksoSignature}`;

  if (request.headers) {
    request.headers['Content-Type'] = contentType;
    request.headers['X-Kso-Date'] = date;
    request.headers['X-Kso-Authorization'] = authorization;
  }
  return request;
}
