# OSS 管理前端

基于 Vue 3、Vue Router、Pinia、Element Plus 和 Vite 的 OSS 管理系统前端。

本模块为独立 Maven 模块 `hive-oss-frontend`，仅包含静态资源；由 `hive-oss` 后端依赖本模块 JAR，在运行时从 classpath 提供静态资源（同源、同一端口）。

## 项目结构

- **frontend-app/**：前端源码与 Vite 构建配置；`npm run build` 输出到 `target/generated-resources/static/`。
- **target/generated-resources/static/**：构建产物，由 Maven 打包进 `hive-oss-frontend` JAR，并由 hive-oss 运行时从 classpath 提供。

```
frontend-app/
├── index.html                    # Vue SPA 入口
├── src/                          # Vue 源码
├── public/serve.json
├── vite.config.js
└── package.json

target/generated-resources/static/（构建后）
├── index.html
├── assets/*.js, *.css
└── serve.json
```

## 开发与构建

```bash
# 推荐：在 frontend-app 中开发与构建
cd frontend-app
npm ci
npm run dev    # 开发服务器 http://localhost:3000
npm run build  # 先类型检查，再产出到 ../target/generated-resources/static/

# 或直接由 Maven 安装/更新依赖、构建并打包静态资源
cd ..
mvn package

# 或仅本地预览已构建的 static
cd target/generated-resources/static
npx serve . --config serve.json
```

## 访问地址

- **首页（推荐入口）**：开发时 http://localhost:3000/index.html ；运行 hive-oss 应用时 http://localhost:8080/index.html 。首页包含数据库备份/恢复与文件分类入口。
- **文件管理页**：`/#/files/{category}`，例如 http://localhost:3000/#/files/PHOTO 。
- **分类管理页**：`/#/admin/categories`。

## 技术栈

- Vue 3 + Vue Router + Pinia
- Element Plus
- TypeScript + Vite
- RESTful API（后端 hive-oss）

## 接口文档

详见 [API.md](./API.md)。

## 重构后回归清单（人工验证）

在确保逻辑无变更的前提下，建议按下列链路逐项验证行为与 API/轮询一致：

- **首页**：备份（触发 → 轮询 ACK → 完成/失败）、刷新备份列表、恢复（单批次 → 轮询 → 完成/失败）、分类列表刷新、点击分类跳转文件页。
- **文件页**：列表加载与分页、搜索与清除、上传（选文件 → 进度 → 成功/失败）、下载（任务 → 轮询 → 下载）、解冻（轮询）、删除、确认删除、远程同步、返回首页。
- **通用**：通知与确认弹窗的触发与关闭、hash 路由跳转、构建产物静态资源加载。

## 首页任务状态展示（备份/恢复）

`index.html` 首页的“数据库备份与加载”区域新增了统一任务状态面板，用于显示任务执行中的实时信息。

- 展示字段：任务类型、批次号、阶段、详情、更新时间、轮询次数、已耗时秒数。
- 运行中状态：显示 `进行中` 徽标和 spinner，每次 ACK 轮询都会更新状态信息。
- 终态保留：任务成功或失败后，状态面板不会立即隐藏，便于查看最终结果。
- 按钮行为：
  - 备份运行中会禁用“开始备份”按钮，结束后恢复。
  - 恢复运行中会禁用所有“恢复”按钮，结束后按可恢复状态恢复可点击性。
