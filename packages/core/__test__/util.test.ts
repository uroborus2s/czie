import { expect, test } from 'vitest';
import { encodeChinese, encodeHanzi } from '../src';

test('加密汉字', () => {
  const res = encodeChinese('30020042南艺231(本)');
  expect(res).toBe('300200422133533402231402641241');
});

test('转换汉字为拼音', () => {
  const res = encodeHanzi('300800本科生2023外国语言文学类英语类231');
  expect(res).toBe('300800bks2023wgyywxlyyl231');
});
