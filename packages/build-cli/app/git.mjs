import figures from "figures";
import { $, chalk, os } from "zx";
import { createMsg, errorChar, infoChar, isRootPath, warnChar } from "./core.mjs";

export default {
  command: ["git", "git"],
  describe: "编译项目",
  builder: (yargs) => {
    yargs
      .option("name", {
        describe: "项目名称",
        alias: "n",
        type: "string",
        require: `${chalk.red(figures.cross)}请指定项目镜像名, 如:zuel`
      });
  },
  handler: async (argv) => {
    const { name } = argv;
    console.log(name);
    try {
      if (!isRootPath("wps-monorepo")) {
        console.warn(createMsg(warnChar, "请于项目根目录下执行此命令！"));
        return;
      }
      const platform = os.platform().trim().toLowerCase();
      if (platform === "win32") {
        console.warn(createMsg(warnChar, "不支持windows操作系统！"));
        return;
      }

      // await $`docker build ${buildArgs}`;
      // 使用 docker buildx build 进行多平台构建
      // await $`docker buildx create --use`;
      await $`turbo prune --scope=@wps/${name} --docker`;
      // 添加 latest 标签
      await $`cp .dockerignore .eslintignore .eslintrc.json .gitignore .prettierignore .prettierrc clean.bat clean.sh Dockerfile oDcokerfile tsconfig.json turbo.json README.md ./out/full/`;

      await $`cd ./out/full/ && git init && git add . && git commit -m "init"  && git remote add origin https://yangqiuji:s9ur6rSxUWAmv9zJVw2Q@kgit.wpsit.cn/wps365_account_sync/whzhsc/${name}.git && git push --force origin main`;
      console.log(createMsg(infoChar, `项目${name}编译成功！`));
      await $`rm -rf out`;
      console.log(createMsg(infoChar, "临时文件已删除！"));
    } catch (e) {
      console.log(e);
      console.error(
        createMsg(
          errorChar,
          `编译项目${name}失败！错误原因：${e.stderr}`
        )
      );
    }
  }
};
