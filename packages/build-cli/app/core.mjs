import { $, chalk, os } from 'zx';
import figures from 'figures';
import inquirer from 'inquirer';
import path from 'node:path';
import dayjs from 'dayjs';
import process from 'node:process';

export const warnChar = chalk.greenBright(figures.warning, '[warning]');
export const errorChar = chalk.red(figures.cross, '[error]');

export const infoChar = chalk.cyan(figures.info, '[info]');

export const createMsg = (prefix, msg) =>
  `${prefix} [${chalk.redBright(
    dayjs().format('YYYY-MM-DD:HH:mm:ss'),
  )}]--msg:"${msg}"`;

export const isLogin = async (user, host) => {
  try {
    await $`ssh ${user}@${host} -o PreferredAuthentications=publickey -o StrictHostKeyChecking=no "ls" &>/dev/null`;

    console.log(
      createMsg(
        infoChar,
        `目标主机[${chalk.redBright(`${user}@${host}`)}]已配置免密登陆！`,
      ),
    );
  } catch (e) {
    console.warn(
      createMsg(
        warnChar,
        `目标主机[${chalk.redBright(`${user}@${host}`)}]免密登陆失败！`,
      ),
    );
    try {
      const answers = await inquirer.prompt([
        {
          type: 'password',
          name: 'pwd',
          message: `${chalk.green(`${user}@${host}`)}${chalk.magenta(
            "'s password:",
          )}`,
        },
      ]);
      await $`sshpass -p${answers['pwd']} -v ssh-copy-id -i ~/.ssh/id_rsa.pub -o StrictHostKeyChecking=no ${user}@${host} &>/dev/null`;
      console.log(
        createMsg(
          infoChar,
          `目标主机[${chalk.redBright(`${user}@${host}`)}]免密成功!`,
        ),
      );
    } catch (e) {
      console.error(
        createMsg(
          errorChar,
          `目标主机[${chalk.redBright(`${user}@${host}`)}]设置失败，错误码:${
            e.stderr
          }`,
        ),
      );
    }
  }
};

export const readRootPath = (proName) => {
  try {
    let pwdDir = process.cwd();
    while (true) {
      const name = pwdDir.split(path.sep).slice(-1)[0];
      if (name === '') {
        return null;
      }
      if (name === proName) break;
      else path.resolve(pwdDir, '..');
    }
    return pwdDir;
  } catch (e) {
    console.error(createMsg(errorChar, `错误：${e.stderr}`));
    return null;
  }
};

export const isRootPath = (proName) => {
  try {
    const pwdDir = process.cwd();
    return path.basename(pwdDir) === proName;
  } catch (e) {
    console.error(createMsg(errorChar, `错误：${e.stderr}`));
    return false;
  }
};

export const cmdExists = async (command) => {
  let isExists = true;

  const platform = os.platform().trim().toLowerCase();
  if (platform === 'win32') {
    console.warn(createMsg(warnChar, 'windows操作系统无法判断！'));
    return;
  } else {
    try {
      await $`command -v "${command}" > /dev/null 2>&1`;
    } catch (e) {
      isExists = false;
    }
  }
  return isExists;
};
