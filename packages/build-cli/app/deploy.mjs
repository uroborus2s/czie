import {
  createMsg,
  errorChar,
  infoChar,
  isRootPath,
  warnChar,
} from './core.mjs';
import { chalk, ssh, $ } from 'zx';
import figures from 'figures';
import dayjs from 'dayjs';

export default {
  command: ['deploy', 'd'],
  describe: '部署项目',
  builder: (yargs) => {
    yargs
      .option('host', {
        describe: '远程服务器的host',
        alias: 'h',
        type: 'string',
        require: true,
      })
      .option('user', {
        describe: '远程服务器登陆用户名',
        alias: 'u',
        type: 'string',
        default: 'root',
        require: true,
      })
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
        default: '0.0.1',
        require: `${chalk.red(figures.cross)}请指定镜像版本, 如:0.0.1`,
      });
  },
  handler: async (argv) => {
    const { host, user, name, tag } = argv;
    const url = `${user}@${host}`;
    try {
      const $ssh = ssh(url);
      await $ssh`[ -d ~/webapp ] || mkdir ~/webapp`;

      try {
        await $ssh`command -v "docker" > /dev/null 2>&1`;
        console.info(
          createMsg(
            infoChar,
            `the "docker" command appears to already exist on this system.`,
          ),
        );
        try {
          if (!isRootPath('wps-monorepo')) {
            console.warn(createMsg(warnChar, '请于项目根目录下执行此命令！'));
            return;
          }
          console.log(name, tag, user, host);
          console.log(dayjs().format('YYYY-MM-DD HH:mm:ss'));
          await $`scp ${name}-${tag}.tar packages/${name}/docker-compose.yml packages/${name}/.env ${url}:~/webapp/`;
          await $`scp -r -O packages/${name}/conf/ ${url}:~/webapp/`;
          await $ssh`cd ~/webapp && docker load < ${name}-${tag}.tar && docker compose up -d && (yes||true) | docker image prune`;
          console.log(createMsg(infoChar, '文件部署成功！'));
        } catch (e) {
          console.log(e);
          console.error(
            createMsg(
              errorChar,
              `拷贝文件错误,code:${e.exitCode},srderr:${e.stderr}`,
            ),
          );
        }
      } catch (e) {
        try {
          await $ssh`curl -fsSL https://get.docker.com -o install-docker.sh && sh install-docker.sh`;
          await $ssh`cat > /etc/docker/daemon.json <<-'EOF'
{
  "log-driver":"json-file",
  "log-opts":{
    "max-size" :"500m",
    "max-file":"3"
  }
}
EOF`;
          await $ssh`systemctl start docker`;
          console.log(createMsg(infoChar, '安装docker成功！'));
        } catch (e) {
          console.error(
            createMsg(
              errorChar,
              `安装docker失败！code:${e.exitCode},stderr:${e.stderr}`,
            ),
          );
        }
      }
    } catch (e) {
      console.log(e);
      console.error(
        createMsg(
          errorChar,
          `部署项目${name}:${tag}失败！错误原因：${e.stderr}`,
        ),
      );
    }
  },
};
