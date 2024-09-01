import crypto from 'crypto-js';
import fs from 'node:fs';
import { Logger } from 'winston';
import { constants, privateDecrypt, publicEncrypt } from 'crypto';
import { getAbsolute } from './utils';

export const tripleDESCBCEncode = (
  encrypted: string,
  skey: string,
  siv: string,
) => {
  const iv = crypto.enc.Utf8.parse(siv);
  const key = crypto.enc.Utf8.parse(skey);
  const encode = crypto.TripleDES.encrypt(encrypted, key, {
    iv,
    mode: crypto.mode.CBC,
    padding: crypto.pad.Pkcs7,
  });
  return crypto.enc.Hex.stringify(encode.ciphertext).toUpperCase();
};

export function aesEncrypted(text: string, key: string) {
  const keyArray = crypto.enc.Utf8.parse(key);
  const encrypted = crypto.AES.encrypt(text, keyArray, {
    mode: crypto.mode.ECB,
    padding: crypto.pad.Pkcs7,
  });
  const hexStr = encrypted.ciphertext.toString().toUpperCase();
  const oldHexStr = crypto.enc.Hex.parse(hexStr);
  // 将密文转为Base64的字符串
  return crypto.enc.Base64.stringify(oldHexStr);
}

export function ecbEncrypted(text: string, srcKey: string) {
  let key = Buffer.from(srcKey);
  // 确保密钥长度为8字节
  if (key.length > 8) {
    key = key.slice(0, 8);
  } else if (key.length < 8) {
    key = Buffer.concat([key, Buffer.alloc(8 - key.length)]);
  }

  // 将密钥转换为 WordArray
  const keyWordArray = crypto.enc.Utf8.parse(key.toString('utf8'));
  // 加密数据
  const encrypted = crypto.DES.encrypt(text, keyWordArray, {
    mode: crypto.mode.ECB,
    padding: crypto.pad.Pkcs7,
  });

  return encrypted.ciphertext.toString(crypto.enc.Hex);
}

// 计算CBC模式的AES加密，IV随机生产，返回"iv:encrypted"base64字符串
export function encryptAESCBCData(text: string, key: string) {
  // 生成16字节的随机IV
  const iv = CryptoJS.lib.WordArray.random(16);
  // AES加密
  const encrypted = CryptoJS.AES.encrypt(text, CryptoJS.enc.Hex.parse(key), {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  // 将 iv 和加密后的数据以 "iv:encryptedData" 的格式组合
  const combinedData = `${iv.toString(CryptoJS.enc.Hex)}:${encrypted.toString()}`;

  // 返回 Base64 编码的字符串
  return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(combinedData));
}

// 计算CBC模式的AES加密，IV随机生产，返回"iv:encrypted"base64字符串
export function decryptAESCBCData(encryptedData: string, key: string) {
  // 解码 Base64 并转换为 UTF-8 字符串
  const decodedData = CryptoJS.enc.Base64.parse(encryptedData).toString(
    CryptoJS.enc.Utf8,
  );
  // 分割出 IV 和加密数据
  const [ivHex, encryptedText] = decodedData.split(':');

  // 解析 IV
  const iv = CryptoJS.enc.Hex.parse(ivHex);

  // AES解密
  const decrypted = CryptoJS.AES.decrypt(
    encryptedText,
    CryptoJS.enc.Hex.parse(key),
    {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    },
  );

  // 返回解密后的明文
  return decrypted.toString(CryptoJS.enc.Utf8);
}

// 读取公钥和私钥，返回证书文件的内容
export function getCertificate({
  dir,
  extname,
  filePath,
  logger,
}: {
  dir: string;
  extname: string | string[];
  filePath?: string;
  logger?: Logger;
}) {
  const certificateFilePath = getAbsolute({
    dir,
    extname,
    filePath,
    logger,
  });
  const logFun = logger || console;
  if (!certificateFilePath) {
    logFun.error('证书文件路径不存在');
    throw new Error('证书文件路径不存在');
  }
  try {
    logFun.info(`读取Certificate文件路径：${certificateFilePath}`);

    // 确保两个文件都找到了
    // 读取文件内容
    // 构造并返回结果对象
    return fs.readFileSync(certificateFilePath, 'utf8');
  } catch (e) {
    logFun.error(JSON.stringify(e));
    throw e;
  }
}

/**
 * 使用公钥进行 RSA 加密
 * @param {Object} data - 要加密的对象数据
 * @returns {string} - 加密后的数据（Base64编码）
 */
export function rsaEncrypt(data: any, publicKey: string) {
  const buffer = Buffer.from(JSON.stringify(data), 'utf8');
  const encrypted = publicEncrypt(publicKey, buffer);
  return encrypted.toString('base64');
}

/**
 * 使用私钥进行 RSA 解密
 * @param {string} encryptedData - 已加密的数据（Base64编码）
 * @returns {Object} - 解密后的数据
 */
export function rsaDecrypt(encryptedData: string, privateKey: string) {
  // 获取块大小
  const chunkSize = privateDecrypt(
    {
      key: privateKey,
      padding: constants.RSA_NO_PADDING,
    },
    Buffer.from(''),
  ).length;
  // 首先将Base64编码的密文解码为二进制数据
  const encryptedBuffer = Buffer.from(encryptedData, 'base64');
  // 确认密文是否是块大小的整数倍
  if (encryptedBuffer.length % chunkSize !== 0) {
    throw new Error(
      '密文的长度不是密钥块长度的整数倍，密文可能已损坏或不完整。',
    );
  }
  // 尝试使用不同的填充方式解密
  let decryptedData = Buffer.alloc(0);
  for (let i = 0; i < encryptedData.length; i += chunkSize) {
    const chunk = encryptedBuffer.slice(i, i + chunkSize);
    // 检查块的长度，如果小于预期长度则跳过
    if (chunk.length !== chunkSize) {
      console.warn(
        `Skipping chunk ${i / chunkSize + 1}: length does not match expected chunk size.`,
      );
      continue;
    }
    try {
      // 尝试使用OAEP填充方式解密
      const decryptedChunk = privateDecrypt(
        {
          key: privateKey,
          padding: constants.RSA_PKCS1_PADDING,
        },
        chunk,
      );
      decryptedData = Buffer.concat([decryptedData, decryptedChunk]);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  return JSON.parse(decryptedData.toString('utf8'));
}
