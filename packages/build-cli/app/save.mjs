import { $, chalk, fs, os } from 'zx';
import figures from 'figures';
import {
  createMsg,
  errorChar,
  infoChar,
  isRootPath,
  readRootPath,
  warnChar,
} from './core.mjs';

export default {
  command: ['save', 's'],
  describe: '编译项目',
  builder: (yargs) => {
    yargs
      .option('name', {
        describe: '项目名称',
        alias: 'n',
        type: 'string',
        require: `${chalk.red(figures.cross)}请指定项目镜像名, 如:zuel`,
      })
      .option('tag', {
        describe: 'docker包的tag',
        alias: 't',
        type: 'string',
        default: '1.0.0',
        require: `${chalk.red(figures.cross)}请指定镜像版本, 如:0.0.1`,
      })
      .option('file', {
        describe: 'docker文件名称',
        alias: 'f',
        type: 'string',
      });
  },
  handler: async (argv) => {
    const { name, file, tag } = argv;
    try {
      if (!isRootPath('wps-monorepo')) {
        console.warn(createMsg(warnChar, '请于项目根目录下执行此命令！'));
        return;
      }
      const platform = os.platform().trim().toLowerCase();
      if (platform === 'win32') {
        console.warn(createMsg(warnChar, '不支持windows操作系统！'));
        return;
      }

      const arch = os.arch().trim().toLowerCase();
      
      if (file) {
        if (arch === 'arm64' || arch === 'aarch64') {
          await $`docker build --platform linux/amd64 --file ${file} --build-arg PACKAGE_NAME=@wps/${name} --network host . -t ${name}:${tag}`;
        } else
          await $`docker build --file ${file} --build-arg PACKAGE_NAME=@wps/${name} --network host . -t ${name}:${tag}`;
      } else {
        if (arch === 'arm64' || arch === 'aarch64') {
          await $`docker build --platform linux/amd64 --build-arg PACKAGE_NAME=@wps/${name} --network host . -t ${name}:${tag}`;
        } else {
          await $`docker build --build-arg PACKAGE_NAME=@wps/${name} --build-arg --network host . -t ${name}:${tag}`;
        }
      }
      await $`(yes||true) | docker container prune`;
      await $`(yes||true) | docker image prune`;
      const pwdDir = readRootPath('wps-monorepo');
      if (pwdDir === null) {
        console.warn(createMsg(warnChar, '请于项目目录下执行此命令！'));
        return;
      }
      const tarFile = `${pwdDir}/${name}-${tag}.tar`;
      if (fs.pathExistsSync(tarFile)) {
        fs.removeSync(tarFile);
      }
      await $`docker save -o ${tarFile} ${name}:${tag}`;
      console.log(createMsg(infoChar, `编译项目${name}:${tag}成功！`));
    } catch (e) {
      console.error(
        createMsg(
          errorChar,
          `编译项目${name}:${tag}失败！错误原因：${e.stderr}`,
        ),
      );
    }
  },
};
