# OSS 管理前端 (Vite 构建)

Vue 3 单页应用源码目录，构建产物输出到 `../target/generated-resources/static`，由 Maven 打包进 `hive-oss-frontend` JAR 后通过 hive-oss 后端同源提供静态资源。

## 开发

```bash
npm ci
npm run dev    # 开发服务器 http://localhost:3000
npm run build  # 构建到 ../target/generated-resources/static/
```

## 结构

- `index.html`：Vue SPA 入口
- `src/router/`：hash 路由，包含首页、文件页、分类管理页
- `src/views/`：页面组件
- `src/stores/`：Pinia 状态与轮询逻辑
- `src/api/`：后端 REST API 封装
- `public/`：构建时原样复制到 static 根目录
