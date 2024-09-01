import { expect, test } from 'vitest';
import {
  aesEncrypted,
  distinguish,
  expiredTimestamp,
  timestampUnix,
  tripleDESCBCEncode,
} from '../src';

test('导入db 文件夹-绝对路径', () => {
  const now = timestampUnix();
  expiredTimestamp(now, 6);
});

test('3des cbc加解密', () => {
  const query = 'STUDENTID=2017&pageSize=5&pageNo=1';
  const param = `<param><module>IcdcShare</module><method>getBksJbxx</method><params>${query}</params></param>`;
  const res = tripleDESCBCEncode(param, 'll.ecjtull.ecjtull.ecjtu', '01234567');
  expect(res).toBe(
    'C87F7EC9D2D431D01690AE90642446B0517BB02FC9543F6032EE24CF3CEB86FDC4E77FBBEE7E5C1756C432BD3A2E3EF90B52E801EBB74C9B953DCFD765C91EBBDEDD29C43A3FC72270E8F7030BDDC476136F939940F2C5A660E32A741DA4847ADDF80AFDF3BB41E1F279D300A475DDEC137263168E6E2140',
  );
});

test('AES加密', () => {
  const res = aesEncrypted(
    JSON.stringify({ type: 'dept' }),
    '4321201909021750',
  );
  expect(res).toBe('wG4wtjGCKXICcD2bt2M5xA==');
});

test('AES加密-faculty', () => {
  const res = aesEncrypted(
    JSON.stringify({ type: 'faculty' }),
    '4321201909021750',
  );
  expect(res).toBe('P1zU0XWmdMZU5ng/aDR8dS8oKh4fsmv3wiLPLxYItqU=');
});

test('数组去重', () => {
  distinguish().distinguishUsers([]);
});

// test('呼职sign', () => {
//   const nowTime = dayjs().valueOf();
//   const orgSting = `17472003827460464665ef33c0c9814476690679cd9585908f1${String(
//     nowTime,
//   )}`;
//   const sign = md5Base64(orgSting);
//   console.log(
//     encodeURIComponent("是否使用 eq '1'"),
//   );
//   console.log(nowTime);
//   console.log(sign);
// });

test('3des加密', () => {
  const method = 'getAllUserJbxx';
  const query = 'pageSize=100&pageNo=1';
  const param = `<param><module>IcdcShare</module><method>${method}</method><params>${query}</params></param>`;
  const res = tripleDESCBCEncode(param, '0818b2840f9018b8461e9830', '01234567');
  expect(res).toBe(
    'C87F7EC9D2D431D01690AE90642446B0517BB02FC9543F6032EE24CF3CEB86FDC4E77FBBEE7E5C1756C432BD3A2E3EF90B52E801EBB74C9B953DCFD765C91EBBDEDD29C43A3FC72270E8F7030BDDC476136F939940F2C5A660E32A741DA4847ADDF80AFDF3BB41E1F279D300A475DDEC137263168E6E2140',
  );
});

// test('', async () => {
//   const filePath = path.join(path.resolve(__dirname), './test.xml');
//   const xmlData = fse.readFileSync(filePath);
//   const data = await xml.parseStringPromise(xmlData);
//   const {
//     'SOAP-ENV:Envelope': {
//       'SOAP-ENV:Body': [
//         {
//           'saml1p:Response': [
//             {
//               'saml1:Assertion': [
//                 {
//                   'saml1:AttributeStatement': [
//                     { 'saml1:Attribute': attribute },
//                   ],
//                 },
//               ],
//             },
//           ],
//         },
//       ],
//     },
//   } = data;
//   console.log(attribute);
//   const {
//     'saml1:AttributeValue': [userId],
//   } = attribute[0];
//   const {
//     'saml1:AttributeValue': [name],
//   } = attribute[8];
//   console.log(userId);
//   console.log(name);
// });
