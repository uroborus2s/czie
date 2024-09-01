import { $, chalk } from 'zx';
import figures from 'figures';
import {
  createMsg,
  errorChar,
  infoChar,
  isRootPath,
  warnChar,
} from './core.mjs';

export default {
  command: ['debug'],
  describe: '启动调试项目',
  builder: (yargs) => {
    yargs
      .option('name', {
        describe: '项目名称',
        alias: 'n',
        type: 'string',
        require: `${chalk.red(figures.cross)}请指定项目镜像名, 如:zuel`,
      })
      .option('sshd', {
        describe: 'ssh隧道',
        type: 'boolean',
        default: false,
      })
      .option('host', {
        describe: '建立隧道的host',
        type: 'string',
      }).option('user', {
        describe: '远程服务器登陆用户名',
        alias: 'u',
        type: 'string',
        default: 'root',
      });
  },
  handler: async (argv) => {
    const { name, sshd, host,user } = argv;
    console.log(sshd);
    if (!isRootPath('wps-monorepo')) {
      console.warn(createMsg(warnChar, '请于项目根目录下执行此命令！'));
      return;
    }
    try {
      await $`command -v "docker" > /dev/null 2>&1`;
    } catch (e) {
      console.log(e);
      console.error(createMsg(errorChar, `请先安装docker！${e.stderr}`));
      return;
    }
    try {
      const res = (
        await $`docker inspect --format '{{.State.Running}}' redis`
      ).stdout.trim();
      if (res === 'false') {
        await $`docker start redis`;
      }
    } catch (e) {
      console.warn(createMsg(warnChar, `${e.stderr}`));
      $`cd packages/${name} && docker compose up -d redis`
        .then(() => console.log(createMsg(infoChar, 'redis启动成功')))
        .catch(() => console.error('redis启动失败'));
    }
    try {
      await $`pnpm --filter @wps/${name} run dev`;
    } catch (e) {
      console.log(e);
    }
  },
};
