import { createHash, createHmac } from 'node:crypto';
import dayjs from 'dayjs';
import fs from 'node:fs';
import readline from 'node:readline';
import type { RemoteDeptBaseInfo, RemoteUserInfo } from '@wps/types-context';
import pinyin from 'pinyin';
import path from 'node:path';
import { Logger } from 'winston';

/**
 * 延迟
 * @param ms 延迟的时间（毫秒）
 */
export async function sleep(ms: number) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * 将字符串的首字母转换为大写或者小写
 * @param origin 需要转换的字符串
 * @param cap 模式：true 将首字母大写转换为小写，false 将首字母小写转换为大写，默认true
 * return 返回时间戳的字符串格式
 */
export function initialCase(origin: string, cap = true) {
  let out = origin.replace(/\s+/g, '');
  if (cap) {
    out = out.charAt(0).toLowerCase() + out.slice(1);
  } else {
    out = out.charAt(0).toUpperCase() + out.slice(1);
  }
  return out;
}

/**
 * 将时间戳(秒)转换为template的字符串
 * @param timestamp 时间戳（秒）
 * @param template 时间字符串模版
 * return 返回时间戳的字符串格式
 */
export function conversionTime(
  timestamp: number,
  template = 'YYYYMMDDHHmmssSSS',
) {
  return dayjs(timestamp).format(template);
}

/**
 * 将字符串进行md5加密
 * @param origin 原始字符串
 */
export function cryptoMD5(origin: string) {
  return createHash('md5').update(origin).digest('hex');
}

/**
 * 给定一个字符串作为参数，根据以下规则进行转换并返回新字符串：
 *
 * 分成由空格字符 (0x20) 分隔的单词。
 * 每个单词的第一个字符大写。
 * Join the words together with no separator.
 * Remove all non-word ([0-9a-z_]) characters.
 *
 * @param {string} str
 * @returns {string}
 * @public
 */
export function toIdentifier(str: string) {
  return str
    .split(' ')
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join('')
    .replace(/[^ _0-9a-z]/gi, '');
}

export function hmacSHA256Sign({
  uuid,
  timestamp,
  url,
  remoteKey,
  remoteApp,
}: {
  uuid: string;
  timestamp: string;
  url: string;
  remoteApp: string;
  remoteKey: string;
}) {
  const signString = `GET
    application/json; charset=utf-8
    ${dayjs(Number(timestamp)).toString()}
    x-ca-version:1
    x-ca-timestamp:${timestamp}
    x-ca-stage:RELEASE
    x-ca-key:${remoteApp}
    x-ca-nonce:${uuid}
    ${url}`;
  return createHmac('sha256', remoteKey).update(signString).digest('base64');
}

/**
 * 生成纯数字的随机数
 * @param randomFlag 生成模式。false：固定长度随机数；true：随机长度的随机数，获取min到max的随机长度的随机数
 * @param min 获取随机数的最小长度
 * @param max 获取随机数的最大长度，当false模式时不存在
 * return 返回随机数长度
 */
export function randomWord(randomFlag: boolean, min: number, max?: number) {
  let str = '';
  let range = min;
  const arr = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

  // 随机产生
  if (randomFlag && max) {
    range = Math.round(Math.random() * (max - min)) + min;
  }
  for (let i = 0; i < range; i += 1) {
    const pos = Math.round(Math.random() * (arr.length - 1));
    str += arr[pos];
  }
  return str;
}

export function diffOfArray<
  T1 extends Record<string, any> = {},
  T2 extends Record<string, any> = {},
>(oldDates: T1[], newDates: T2[], compare: (a: T1, b: T2) => boolean) {
  const add = newDates.filter(
    (newDate) => !oldDates.find((old) => compare(old, newDate)),
  );

  const edit = newDates.filter(
    (newDate) => !!oldDates.find((old) => compare(old, newDate)),
  );

  const dele = oldDates.filter(
    (old) => !newDates.find((newDate) => compare(old, newDate)),
  );

  return { dele, add, edit };
}

export const verifyPhone = (phone: string | undefined) => {
  if (phone === undefined) return phone;
  if (phone.length > 11) {
    phone = phone.slice(0, 11);
  }
  if (/^1[3-9]\d{9}$/.test(phone)) return phone;
  return undefined;
};

export const verifyEmployeeId = (employeeId: string | undefined) => {
  if (employeeId === undefined) return employeeId;
  return employeeId.length > 20 ? employeeId.substring(0, 20) : employeeId;
};

export const verifyEmail = (email: string | undefined) => {
  if (email === undefined) return email;
  if (/[a-z0-9]+@[a-z]+\.[a-z]{2,3}/.test(email)) return email;
  return undefined;
};

export const timestampUnix = () => dayjs().unix();

/**
 * 在当前时间的基础上增加n个月的时间戳
 * @param time: 需要增加的时间戳
 * @param m: 需要增华的月份
 * @return 增加后的时间戳
 */
export const expiredTimestamp = (time: number, m: number) =>
  dayjs.unix(time).add(m, 'month').unix();

export const readFileAsObjects = (
  filePath: string,
  asObject: (line: string) => Record<string, unknown>,
): Promise<Record<string, unknown>[]> =>
  new Promise((resolve, reject) => {
    // 确保文件存在
    if (!fs.existsSync(filePath)) {
      reject(new Error(`文件 ${filePath} 不存在`));
      return;
    }

    // 创建文件流
    const fileStream = fs.createReadStream(filePath, 'utf8');

    // 创建 readline 接口
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    const array = [] as Record<string, unknown>[];

    // 逐行读取
    rl.on('line', (line) => {
      const obj = asObject(line);
      array.push(obj);
    });

    // 完成处理
    rl.on('close', () => {
      resolve(array);
    });

    // 错误处理
    fileStream.on('error', (error) => {
      reject(error);
    });
  });

export const mergeArrays = (
  oldDepts: RemoteDeptBaseInfo[],
  newDepts: RemoteDeptBaseInfo[],
) => {
  const { edit, add } = diffOfArray(
    oldDepts,
    newDepts,
    (o, n) => o.deptId === n.deptId,
  );
  for (const editItem of edit) {
    //   删除数组的item
    const index = oldDepts.findIndex((dept) => dept.deptId === editItem.deptId);
    if (index >= 0) {
      oldDepts.splice(index, 1);
    }
    if (Number(editItem.status) === 1) {
      oldDepts.push(editItem);
    }
  }
  for (const addItem of add) {
    if (Number(addItem.status) === 1) {
      oldDepts.push(addItem);
    }
  }
  return oldDepts;
};

export const mergeUsers = (
  oldUsers: RemoteUserInfo[],
  newUsers: RemoteUserInfo[],
) => {
  const { edit, add } = diffOfArray(
    oldUsers,
    newUsers,
    (o, n) => o.userId === n.userId,
  );
  for (const editItem of edit) {
    //   删除数组的item
    const index = oldUsers.findIndex((user) => user.userId === editItem.userId);
    if (index >= 0) {
      oldUsers.splice(index, 1);
    }
    if (Number(editItem.status) === 1) {
      oldUsers.push(editItem);
    }
  }
  for (const addItem of add) {
    if (Number(addItem.status) === 1) {
      oldUsers.push(addItem);
    }
  }
  return oldUsers;
};

export const encodeChinese = (text: string): string => {
  // 使用数组来收集所有的编码
  const encodedNumbers: string[] = [];

  // 遍历文本中的每个字符
  for (const char of text) {
    if (Number.isNaN(parseInt(char, 10))) {
      // 检查字符是否为非数字
      // 将非数字字符的 Unicode 码点转换为字符串，并添加到数组中
      encodedNumbers.push(char.charCodeAt(0).toString());
    } else {
      // 对数字字符不进行编码，直接添加到数组中
      encodedNumbers.push(char);
    }
  }

  // 将编码后的数字连接成一个字符串
  return encodedNumbers.join('');
};

export function createRenamedObject(
  source: Record<string, any>,
  renameRules: Record<string, any>,
) {
  // 初始化一个空的新对象
  const newObj: Record<string, any> = {};
  // 遍历源对象的所有字段
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      // 如果字段在重命名规则中，则使用新名称
      if (Object.prototype.hasOwnProperty.call(renameRules, key)) {
        newObj[renameRules[key]] = source[key];
      } else {
        // 否则，使用原名称
        newObj[key] = source[key];
      }
    }
  }

  // 返回新对象
  return newObj;
}

// 将汉字转换为拼音的字符串,转换的时候去掉汉字中的特殊字符:(),_等非汉字或者字母数字的字符
export const encodeHanzi = (hanzi: string) => {
  if (hanzi.length === 0) {
    return '';
  }

  // 移除特殊字符
  const cleanedHanzi = hanzi.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '');

  // 检查是否包含汉字的正则表达式
  const containsHanzi = /[\u4e00-\u9fa5]/.test(cleanedHanzi);

  // 如果不包含汉字，返回原字符
  if (!containsHanzi) {
    return cleanedHanzi;
  }

  let encodedString = '';

  for (let i = 0; i < cleanedHanzi.length; i += 1) {
    const char = cleanedHanzi[i];
    // 如果是汉字，转换为拼音
    if (/[\u4e00-\u9fa5]/.test(char)) {
      const pinyinArray = pinyin(char, {
        style: pinyin.STYLE_NORMAL,
      });

      if (pinyinArray.length > 0) {
        if (encodedString.length === 0) {
          // 第一字的全拼
          encodedString += pinyinArray[0][0];
        } else {
          // 后续汉字的拼音首字母
          encodedString += pinyinArray[0][0][0];
        }
      }
    } else {
      // 非汉字字符，直接添加
      encodedString += char;
    }
  }
  return encodedString;
};

/**
 * 将对象转换为查询参数字符串
 * @param {Object} params - 要转换的对象
 * @returns {string} - 查询参数字符串
 */
export const toQueryString = (params: Record<string, any>) => {
  const queryString = Object.keys(params)
    .map((key) => {
      const value = params[key];
      if (value === undefined || value === null) {
        return ''; // 忽略 undefined 和 null 的值
      }
      if (Array.isArray(value)) {
        // 如果值是数组，生成多个相同键的参数
        return value
          .map((val) => `${encodeURIComponent(key)}=${encodeURIComponent(val)}`)
          .join('&');
      }
      // 处理其他类型的值
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    })
    .filter((param) => param !== '') // 移除空字符串
    .join('&');
  return queryString;
};

/**
 * 获取绝对路径
 * @param dir 目录
 * @param extname 扩展名
 * @param filePath 文件路径
 * @param logger 日志
 */
export const getAbsolute = ({
  dir,
  extname,
  filePath,
  logger,
}: {
  dir: string;
  extname: string | string[];
  filePath?: string;
  logger?: Logger;
}) => {
  let rFilePath;

  try {
    const files = fs.readdirSync(dir);
    if (!filePath) {
      if (logger) logger.info(`从如下路径中读取文件：${dir}`);
      else console.log(`从如下路径中读取文件：${dir}`);
      for (const file of files) {
        const fileExtName = path.extname(file);
        if (
          Array.isArray(extname)
            ? extname.indexOf(fileExtName) !== -1
            : fileExtName === extname
        ) {
          rFilePath = path.join(dir, file);
        }
      }
    } else if (path.isAbsolute(filePath)) {
      rFilePath = filePath;
    } else if (filePath === path.basename(filePath)) {
      rFilePath = path.join(dir, filePath);
      if (logger) logger.info(`读取文件${rFilePath}`);
      else console.log(`读取文件${rFilePath}`);
    }
  } catch (e) {
    if (logger) logger.error(JSON.stringify(e));
    else console.log(JSON.stringify(e));
  }
  return rFilePath;
};

/**
 * 获取启动文件的入口地址
 * @returns {string} - 入口文件路径
 */
export const getMainDir = (pathString?: string) => {
  const mainDir = require.main
    ? path.dirname(require.main.filename)
    : process.cwd();
  if (pathString) {
    return path.resolve(mainDir, pathString);
  }
  return mainDir;
};
