import { chalk } from "zx";
import figures from "figures";
import { readRootPath } from "./core.mjs";

export default {
  command: ['copy', 'c'],
  describe: '将文件拷贝到服务器中',
  builder: (yargs) => {
    yargs
      .option('name', {
        describe: '项目名称',
        alias: 'n',
        type: 'string',
        require: `${chalk.red(figures.cross)}请指定项目名称, 如:zuel`,
      })
      .option('tag', {
        describe: 'docker包的tag',
        alias: 't',
        type: 'string',
        default: '0.0.1',
        require: `${chalk.red(figures.cross)}请指定镜像版本, 如:0.0.1`,
      });
  },
  handler: async (argv) => {
    const { name, tag } = argv;
    try {
      const pwdDir = readRootPath('wps-monorepo');
      console.log(pwdDir);
    } catch (e) {
      console.log(e);
    }
  },
};
