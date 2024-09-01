export { WPS3Sign, md5Base64, KSOSign_V1 } from './util/sign';

export {
  distinguish,
  type DistinguishOptions,
  type DistinguishUser,
  type DistinguishDept,
} from './util/distinguish';

export {
  sleep,
  conversionTime,
  cryptoMD5,
  hmacSHA256Sign,
  randomWord,
  initialCase,
  diffOfArray,
  verifyPhone,
  verifyEmail,
  verifyEmployeeId,
  timestampUnix,
  expiredTimestamp,
  readFileAsObjects,
  mergeUsers,
  mergeArrays,
  encodeChinese,
  createRenamedObject,
  encodeHanzi,
  toQueryString,
  getAbsolute,
  getMainDir,
} from './util/utils';

export {
  CloudOrgService,
  type DeptNodeRsp,
  type DepTypeDto,
} from './service/cloudorg.service';

export {
  CloudUserService,
  type UserMode,
  type UserTypeDto,
} from './service/clouduser.service';

export { TokenService } from './service/token.service';

export { SpacesService } from './service/spaces.service';

export { GroupsService } from './service/groups.service';

export { CalendarService } from './service/calendar.service';

export { TokenService as TokenServiceV7 } from './wps_v7/token.service';
export { UserGroupService } from './wps_v7/usergroup.service';

export { KScimService, type KScimServiceOptions } from './service/kscimService';

export { asyncPool, filterAsync } from './util/promise';

export { createSSOWeb } from './sso/createSSO';
export { createBaseConfig, createKSCIMConfig } from './context/config';
export type {
  RemoteService,
  WpsService,
  ErrorService,
  ExpandRouterService,
} from './service/service';
export { applyMiddleware, type InterceptorApi } from './sso/applyMiddleware';
export { createErrorService } from './service/errorService';
export { type RedisService } from './context/redisService';
export {
  createCasRouter,
  createKScimServiceRouter,
} from './service/casService';
export { createExpandRouterService } from './service/expandRouterService';
export { newLogger } from './context/logger';
export { newService } from './context/newService';
export { default as createAppContext } from './context';
export { default as buildDeptTree } from './context/buildDeptTree';

export { httpsMiddle } from './sso/sslMiddleware';
export { wpsRouterMiddleware } from './sso/wpsRouterMiddleware';

export { returnError, axiosError, errorLog } from './util/error';

export { OauthByCas, type OauthByCasOptions, casMiddleRoutes } from './sso/cas';

export { isURL, isJS, isPath, isJsonString, isJsonFile } from './util/is';

export {
  tripleDESCBCEncode,
  aesEncrypted,
  ecbEncrypted,
  getCertificate,
  rsaEncrypt,
  rsaDecrypt,
  encryptAESCBCData,
  decryptAESCBCData,
} from './util/crypto';
export {
  HmacSHA256 as wpsHmacSHA256,
  enc,
  MD5,
  AES,
  mode,
  pad,
} from 'crypto-js';

export {
  default as createKoaApp,
  type KoaAppOptions,
} from './koa/createKoaApp';

export { isPlainObject, chain, type ExpChain, mergeWith } from 'lodash';

export { createKoaAppService, type KoaAppService } from './koa';
export { type KoaConfig, createKoaConfig } from './koa/koaAppConfig';

export { onlyHttpsMiddle } from './middle/middle';
