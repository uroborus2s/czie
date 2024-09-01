#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import inquirer from 'inquirer';
import { chalk, fs } from 'zx';
import { createMsg, infoChar, isRootPath, warnChar } from '../app/core.mjs';
import path from 'node:path';

yargs(hideBin(process.argv))
  .usage(
    '$0 [name] [description]',
    '创建账号同步项目',
    (yargs) => {
      return yargs
        .positional('name', {
          describe: '项目名称',
          type: 'string',
        })
        .positional('description', {
          describe: '描述信息',
          type: 'string',
          alias: 'desc',
        });
    },
    async (args) => {
      let { name, desc } = args;
      if (!isRootPath('wps-monorepo')) {
        console.warn(createMsg(warnChar, '请于项目根目录下执行此命令！'));
        return;
      }
      if (name === undefined) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'proName',
            message: `${chalk.green('请输入项目名称：')}`,
          },
        ]);
        name = answers['proName'];
      }
      if (desc === undefined) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'desc',
            message: `${chalk.green('请输入项目描述信息：')}`,
          },
        ]);
        desc = answers['desc'];
      }
      const resDir = fs.mkdirpSync(`project/${name}`);
      if (!resDir) {
        console.warn(warnChar, '项目目录已经存在！请确认名称是否重复');
        return;
      }
      fs.copySync(path.resolve('template'), path.resolve(resDir));
      const packageObj = fs.readJsonSync(path.resolve(resDir, 'package.json'));
      packageObj.name = `@wps/${name}`;
      packageObj.description = desc;
      fs.writeJsonSync(path.resolve(resDir, 'package.json'), packageObj, {
        spaces: '\t',
      });
      console.log(infoChar, '项目创建成功！');
    },
  )
  .parse();
