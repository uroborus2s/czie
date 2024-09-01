# 项目处理
## 新建新项目
在根目录执行如下命令，输入项目名称和描述信息后根据模版创建项目
```shell
pnpm run create test 测试项目
# 或者 运行如下命令然后根据提示输入信息
pnpm run create
```

## 在本地运行项目
```shell
pnpm run debug 
```

# 脚本方式安装docker 和docker compose
> 要安装最新稳定版本的 Docker CLI、Docker Engine 及其依赖项：

## 使用脚本安装步骤
### 1 下载脚本
```shell
$ curl -fsSL https://get.docker.com -o install-docker.sh
```

### 2 验证脚本的内容
```shell
$ cat install-docker.sh
```
### 3 使用 --dry-run 运行脚本以验证其执行的步骤
```shell
$ sh install-docker.sh --dry-run
```
### 4 以 root 身份运行脚本，或使用 sudo 执行安装。
```shell
$ sudo sh install-docker.sh
```
### 5 Start Docker
```shell
$ sudo systemctl start docker
```
## 命令行选项

### --version <VERSION>
使用 --version 选项安装特定版本，例如：
```shell
$ sudo sh install-docker.sh --version 23.0
```
### --channel <stable|test>
使用 --channel 选项从备用安装通道进行安装。  
The following example installs the latest versions from the "test" channel,  
which includes pre-releases (alpha, beta, rc):  

```shell
$ sudo sh install-docker.sh --channel test
```
或者，使用 https://test.docker.com 上的脚本，该脚本默认使用测试通道。  

### --mirror <Aliyun|AzureChinaCloud>
使用 --mirror 选项从此脚本支持的镜像进行安装。  
 可用的镜像阿里云 "Aliyun" (https://mirrors.aliyun.com/docker-ce), 和Azure中国云 "AzureChinaCloud" (https://mirror.azure.cn/docker-ce), for example:  
```shell
$ sudo sh install-docker.sh --mirror AzureChinaCloud
```

## FAQ
### centos 8 安装出现 Problem: problem with installed package buildah…
```shell
$ yum -y erase podman buildah
```

### 苹果电脑提示“未能连接到pulse secure统一网络服务”解决方法
在终端中执行如下命令：
```shell
sudo launchctl load -w /Library/LaunchDaemons/net.pulsesecure.AccessService.plist
```

### docker替换阿里云镜像
新版的 Docker 推荐使用 json 配置文件的方式，默认为 /etc/docker/daemon.json，非默认路径需要修改 dockerd 的 –config-file，在该文件中加入如下内容：  
```text
# Docker 官方中国区
https://registry.docker-cn.com
```
```text
# 阿里云加速镜像
https://8r4914p3.mirror.aliyuncs.com
```

```text
# 网易
http://hub-mirror.c.163.com
```

```text
# ustc
https://docker.mirrors.ustc.edu.cn
```

```json
{ 
"registry-mirrors": ["https://8r4914p3.mirror.aliyuncs.com"] 
}
```

# 旧版安装docker 和 docker-compose
## centos系统
### 安装docker
查看 Linux 发行版本 Docker 要求 CentOS 系统的内核版本高于 3.10
```shell
cat /etc/os-release
```

```shell
# 升级所有包（这步版本够用不要随便进行，会更新系统内核，可能导致开不了机）
# 升级所有包，同时升级软件和系统内核
yum update

# 安装依赖包
yum install -y yum-utils device-mapper-persistent-data lvm2

# 设置 yum 源
yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# 安装docker
yum -y install docker-ce

# 设置开机启动docker
systemctl enable docker

# 重启docker
systemctl restart docker
```

### 安装 Docker-Compose

通过访问 [https://github.com/docker/compose/releases/latest](https://github.com/docker/compose/releases/latest) 得到最新的 docker-compose 版本（例如：2.18.1），然后执行一下命令安装 docker-compose
```shell
# 下载最新版本的 docker-compose 到 /usr/bin 目录下
curl -L https://github.com/docker/compose/releases/download/2.18.1/docker-compose-linux-`uname -m` -o /usr/bin/docker-compose

# 给 docker-compose 授权
chmod +x /usr/bin/docker-compose
```

### Ubuntu系统
查看 Linux 发行版本 验证内核以及架构详细信息：
```shell
cat /etc/os-release
```
支持如下的操作系统版本：  
Ubuntu Lunar 23.04  
Ubuntu Kinetic 22.10  
Ubuntu Jammy 22.04 (LTS)  
Ubuntu Focal 20.04 (LTS)  
Ubuntu Bionic 18.04 (LTS)  

#### 卸载旧版本
在安装 Docker Engine 之前，首先确保已卸载任何有冲突的包。
```shell
for pkg in docker.io docker-doc docker-compose podman-docker containerd runc; do sudo apt-get remove $pkg; done
```

apt-get 可能会报告没有安装这些软件包。
卸载 Docker 时，存储在 /var/lib/docker/ 中的图像、容器、卷和网络不会自动删除。查看卸载章节完整卸载

#### 卸载Docker Engine
1. 卸载 Docker Engine、CLI、containerd 和 Docker Compose 包：
```shell
sudo apt-get purge docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin docker-ce-rootless-extras
```
2. 主机上的图像、容器、卷或自定义配置文件不会自动删除。删除所有镜像、容器和卷：
```shell
sudo rm -rf /var/lib/docker
sudo rm -rf /var/lib/containerd
```

#### 使用 apt repository 安装
在新主机上首次安装 Docker Engine 之前，需要设置 Docker 存储库。之后，可以从存储库安装和更新 Docker。
##### 设置repository
1. 更新 apt 包索引并安装包以允许 apt 通过 HTTPS 使用存储库：
```shell
sudo apt-get update
sudo apt-get install ca-certificates curl gnupg
```
2. 添加 Docker 的官方 GPG key：
```shell
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
```
3. 使用以下命令设置存储库：
```shell
echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

##### 安装 Docker Engine
1. 更新 apt 包索引：
```shell
sudo apt-get update
```
2. 安装 Docker Engine、containerd 和 Docker Compose。 
安装最新版本：
```shell
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```
要安装特定版本的 Docker Engine，首先在存储库中列出可用版本：
```shell
# List the available versions:
apt-cache madison docker-ce | awk '{ print $3 }'

5:24.0.0-1~ubuntu.22.04~jammy
5:23.0.6-1~ubuntu.22.04~jammy
<...>
```
选择所需版本并安装：
```shell
VERSION_STRING=5:24.0.0-1~ubuntu.22.04~jammy
sudo apt-get install docker-ce=$VERSION_STRING docker-ce-cli=$VERSION_STRING containerd.io docker-buildx-plugin docker-compose-plugin
```

