# OSS 管理前端

基于原生技术栈（HTML + CSS + JavaScript）的 OSS 管理系统前端。

本模块为独立 Maven 模块 `hive-oss-frontend`，仅包含静态资源；由 `hive-oss` 后端依赖本模块 JAR，在运行时从 classpath 提供静态资源（同源、同一端口）。

## 项目结构

```
hive-oss-frontend/src/main/resources/static/
├── index.html         # 首页（统一入口：数据库备份与加载、Bucket 选择）
├── pages/             # 页面文件
│   └── files.html     # 文件管理页
├── js/                # JavaScript 文件
│   ├── home.js        # 首页逻辑（数据库备份/恢复、ACK 轮询、备份列表、Bucket 跳转）
│   ├── files.js       # 文件管理逻辑
│   └── utils.js       # 工具函数
├── css/               # 样式文件
│   └── style.css      # 自定义样式
├── serve.json         # 服务器配置（本地开发用）
└── README.md          # 项目说明
```

## 开发环境

```bash
# 在 static 目录下
cd src/main/resources/static

# 安装依赖（如果需要）
npm install -g serve

# 启动开发服务器
npx serve . --config serve.json
```

## 访问地址

- **首页（推荐入口）**：开发时 http://localhost:3000/index.html ；运行 hive-oss 应用时 http://localhost:8080/index.html 。首页包含「数据库备份与恢复」（触发备份、查看 ACK、备份历史、按批次恢复）与「Bucket 选择」。
- 文件管理页：http://localhost:3000/pages/files.html?bucket=xxx（开发）/ http://localhost:8080/pages/files.html?bucket=xxx（应用）。

## 技术栈

- 原生 JavaScript (ES Modules)
- Bootstrap 5.3.2
- RESTful API（后端 hive-oss）

## 接口文档

详见 [API.md](./API.md)。

## 首页任务状态展示（备份/恢复）

`index.html` 首页的“数据库备份与加载”区域新增了统一任务状态面板，用于显示任务执行中的实时信息。

- 展示字段：任务类型、批次号、阶段、详情、更新时间、轮询次数、已耗时秒数。
- 运行中状态：显示 `进行中` 徽标和 spinner，每次 ACK 轮询都会更新状态信息。
- 终态保留：任务成功或失败后，状态面板不会立即隐藏，便于查看最终结果。
- 按钮行为：
  - 备份运行中会禁用“开始备份”按钮，结束后恢复。
  - 恢复运行中会禁用所有“恢复”按钮，结束后按可恢复状态恢复可点击性。
