import fs from 'node:fs';

export const isURL = (s: string) => /^(http|https):/.test(s);

export const isJsonString = (s: string) => {
  try {
    const obj = JSON.parse(s);
    // 等于这个条件说明就是JSON字符串 会返回true
    return !!(typeof obj === 'object' && obj);
  } catch (e) {
    return false;
  }
};

export const isPath = (s: string) =>
  !isURL(s) && !isJsonString(s) && fs.existsSync(s);

export const isJsonFile = (s: string) => /\.json$/.test(s);

export const isJS = (s: string) => /\.[c|m]?[j|t]s$/.test(s);
