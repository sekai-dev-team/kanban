# 前端 CI/CD 自动化部署方案 (Docker + Watchtower)

既然您的后端已经采用 Docker + Watchtower 的方式成功实现了在无公网 IP 环境下的自动更新，那么对于这个前端项目，最优雅且一致的方案是将前端应用也“容器化”。

核心思路如下：
1.  **构建 (Build)**: 使用 GitHub Actions 将前端代码（React/Vite）打包生成静态文件。
2.  **容器化 (Containerize)**: 将生成的静态文件放入一个轻量级的 Nginx 容器中。
3.  **推送 (Push)**: 将构建好的镜像推送到 Docker Hub 或 GitHub Container Registry (GHCR)。
4.  **部署 (Deploy)**: 服务器上的 Watchtower 检测到新镜像，自动拉取并重启容器。

以下是详细的操作步骤：

## 1. 编写 Dockerfile

在项目根目录下创建一个名为 `Dockerfile` 的文件。我们将使用多阶段构建（Multi-stage Build）来减小镜像体积。

```dockerfile
# 第一阶段：构建环境
FROM node:18-alpine as build-stage

WORKDIR /app

# 单独复制 package.json 以利用缓存
COPY package*.json ./
RUN npm ci

# 复制源代码并构建
COPY . .
RUN npm run build

# 第二阶段：生产环境 (Nginx)
FROM nginx:alpine as production-stage

# 复制构建产物到 Nginx 目录
COPY --from=build-stage /app/dist /usr/share/nginx/html

# 复制自定义 Nginx 配置 (处理 SPA 路由问题)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

## 2. 添加 Nginx 配置

前端是单页应用 (SPA)，需要配置 Nginx 将所有 404 请求指向 `index.html`，否则刷新页面会报 404。 
在项目根目录下创建一个名为 `nginx.conf` 的文件：

```nginx
server {
    listen       80;
    server_name  localhost;

    location / {
        root   /usr/share/nginx/html;
        index  index.html index.htm;
        # 关键配置：尝试匹配文件，如果找不到则返回 index.html
        try_files $uri $uri/ /index.html;
    }

    error_page   500 502 503 504  /50x.html;
    location = /50x.html {
        root   /usr/share/nginx/html;
    }
}
```

## 3. 配置 GitHub Actions

在项目根目录下创建目录 `.github/workflows`，并在其中新建文件 `deploy.yml`。
这里以推送到 **Docker Hub** 为例（如果您使用 GHCR，配置略有不同）。

**前提**：
请在 GitHub 仓库的 `Settings` -> `Secrets and variables` -> `Actions` 中添加以下 Secrets：
*   `DOCKERHUB_USERNAME`: 您的 Docker Hub 用户名
*   `DOCKERHUB_TOKEN`: 您的 Docker Hub Access Token

```yaml
name: Build and Push Docker Image

on:
  push:
    branches: [ "main" ] # 监听 main 分支的推送
  workflow_dispatch:      # 允许手动触发

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Check out the repo
        uses: actions/checkout@v4

      - name: Log in to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Extract metadata (tags, labels) for Docker
        id: meta
        uses: docker/metadata-action@v5
        with:
          #! 修改为您的镜像名称，例如: myname/kanban-frontend
          images: ${{ secrets.DOCKERHUB_USERNAME }}/kanban-frontend
          tags: |
            type=raw,value=latest
            type=sha,format=long

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
```

## 4. 服务器端首次部署

一旦您将代码推送到 GitHub 并触发 Actions 构建成功后，您需要在服务器上进行首次运行。

通过 SSH 连接到您的服务器，运行：

```bash
# 1. 拉取镜像 (替换为您实际的镜像名)
docker pull <您的DockerHub用户名>/kanban-frontend:latest

# 2. 启动容器
# 注意：前端运行在容器内的 80 端口，您可以映射到宿主机的任意端口（例如 8080）
docker run -d \
  --name kanban-frontend \
  --restart unless-stopped \
  -p 8080:80 \
  <您的DockerHub用户名>/kanban-frontend:latest
```

## 5. 验证自动更新

由于您已经部署了 Watchtower，只要它配置为监视所有容器（默认行为）或包含这个新容器，流程就完成了：

1.  您在本地修改代码，`git push` 到 `main` 分支。
2.  GitHub Actions 自动构建新镜像并推送到 Docker Hub，标签为 `latest`。
3.  服务器上的 Watchtower 周期性检查 `latest` 标签的哈希值变化。
4.  Watchtower 发现变化，自动停止旧容器，拉取新镜像，并使用相同的参数（端口映射等）重启容器。

这样，您的前端项目就拥有了和后端完全一致的自动化部署流程。
