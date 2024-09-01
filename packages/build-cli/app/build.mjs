import { $, chalk, os } from "zx";
import figures from "figures";
import { createMsg, errorChar, infoChar, isRootPath, readRootPath, warnChar } from "./core.mjs";

export default {
  command: ["build", "b"],
  describe: "编译项目",
  builder: (yargs) => {
    yargs
      .option("name", {
        describe: "项目名称",
        alias: "n",
        type: "string",
        require: `${chalk.red(figures.cross)}请指定项目镜像名, 如:zuel`
      })
      .option("tag", {
        describe: "docker包的tag",
        alias: "t",
        type: "string",
        default: "1.0.0",
        require: `${chalk.red(figures.cross)}请指定镜像版本, 如:0.0.1`
      })
      .option("file", {
        describe: "docker文件名称",
        alias: "f",
        type: "string"
      })
      .option("space", {
        describe: "docker文件名称",
        alias: "s",
        default: "uroborus",
        type: "string"
      });
  },
  handler: async (argv) => {
    const { name, file, tag, space } = argv;
    const dockerImage = `registry.cn-hangzhou.aliyuncs.com/${space}/${name}:${tag}`;
    const dockerImageLatest = `registry.cn-hangzhou.aliyuncs.com/${space}/${name}:latest`;

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

      const arch = os.arch().trim().toLowerCase();
      const isArm = arch === "arm64" || arch === "aarch64";
      const platformArgs = isArm ? ["--platform", "linux/amd64"] : [];
      const networkArgs = ["--network", "host"];

      // await $`docker buildx create --use --buildkitd-flags '--allow-insecure-entitlement network.host'`;

      const buildArgs = [
        "docker",
        "build",
        ...platformArgs,
        ...(file ? ["--file", file] : []),
        "--progress=plain",
        "--build-arg",
        `PACKAGE_NAME=@wps/${name}`,
        "--no-cache",
        ".",
        "--tag",
        dockerImage,
        ...networkArgs
      ];

      // await $`docker build ${buildArgs}`;
      // 使用 docker buildx build 进行多平台构建
      // await $`docker buildx create --use`;
      await $`${buildArgs}`;
      // 添加 latest 标签
      await $`docker tag ${dockerImage} ${dockerImageLatest}`;

      await $`(yes||true) | docker container prune`;
      await $`(yes||true) | docker image prune`;
      const pwdDir = readRootPath("wps-monorepo");
      if (pwdDir === null) {
        console.warn(createMsg(warnChar, "请于项目目录下执行此命令！"));
        return;
      }

      console.log(`推送 Docker 镜像 ${dockerImage} 到阿里云...`);
      await $`docker push ${dockerImage}`;
      console.log(
        `推新并推送 latest 标签的镜像{dockerImageLatest} 到阿里云...`
      );
      await $`docker tag ${dockerImage} ${dockerImageLatest}`;
      await $`docker push ${dockerImageLatest}`;

      console.log(`清理本地镜像...`);
      await $`docker rmi ${dockerImage}`;
      await $`docker rmi ${dockerImageLatest}`;
      console.log(createMsg(infoChar, `编译项目${dockerImage}成功！`));
    } catch (e) {
      console.error(
        createMsg(
          errorChar,
          `编译项目${name}:${tag}失败！错误原因：${e.stderr}`
        )
      );
    }
  }
};
