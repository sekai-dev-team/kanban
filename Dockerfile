# 第一阶段：构建环境
FROM node:18-alpine AS build-stage

WORKDIR /app

# 单独复制 package.json 以利用缓存
COPY package*.json ./
RUN npm ci

# 复制源代码并构建
COPY . .
RUN npm run build

# 第二阶段：生产环境 (Nginx)
FROM nginx:alpine AS production-stage

# 复制构建产物到 Nginx 目录
COPY --from=build-stage /app/dist /usr/share/nginx/html

# 复制自定义 Nginx 配置 (处理 SPA 路由问题)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]