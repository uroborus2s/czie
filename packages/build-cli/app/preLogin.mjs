import { isLogin } from './core.mjs';
export default {
  command: ['pre-login', 'login'],
  describe:
    "登陆远程服务器并设置自动免密登陆，请保证本机 '${HOME}/.ssh/id_rsa.pub' 存在！",
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
      });
  },
  handler: async (argv) => {
    const { user, host } = argv;
    await isLogin(user, host);
  },
};
