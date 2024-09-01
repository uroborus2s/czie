import { cmdExists, readRootPath } from './core.mjs';
import { os } from 'zx';

export default {
  command: ['info [type]', 'i'],
  describe: '获取系统info信息',
  builder: (yargs) => {
    yargs.positional('type', {
      describe: '信息类型',
      type: 'string',
    });
  },
  handler: async (argv) => {
    const { type } = argv;
    let sInfo = 0;
    try {
      switch (type) {
        case 'arch':
          sInfo = os.arch();
          break;
        case 'platform':
          sInfo = os.platform();
          break;
        case 't':
          cmdExists('docker').then((res) => console.log(res));
          break;
        default:
          sInfo = {
            arch: os.arch(),
            platform: os.platform(),
          };
          break;
      }
      console.log(sInfo);
    } catch (e) {
      console.log(e);
    }
  },
};
