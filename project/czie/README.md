# 访问登录方式
## 打开kdocs.cn,进入网页版，选择sso专属账号，xxxx，在cas认证即可登录
## 在浏览器输入 xxxxxxxx,进入企业专属登录页面
## 打开wps客户端，选择企业登录，输入xxxxxx,在cas页面认证登录

# 编译项目
```shell
cd xxx/wps-monorepo
pnpm i
pnpm run docker -n xxx
```
执行后在根目录生成 xxx-1.0.0.tar 文件

# 运行项目
将文件上传到服务器到/root/webapp,将images导入并重新部署
```shell
cd /root/webapp
sudo docker load < xxx-1.0.0.tar
docker compose up -d
```

# 基础运维服务
```shell
# 重启服务
sudo docker compose restart

# 停止服务
sudo docker compose stop

# 查看log
sudo docker compose logs -f

# 启动服务
sudo docker compose up -d

# docker 重启
sudo systemctl restart docker 

# docker 状态
sudo systemctl status docker
```

上传至服务器webapp目录下的文件列表，文件位于(./project/xxxx)下
- .env
- docker-compose.yml
- conf/redis/redis.conf

# 代码说明
packages/core           - 公共库  
packages/appcontext     - 基础类型
packages/sqlite         - 本地数据库
packages/wpssync        - 同步服务代码
project/xxxx            - 项目源代码