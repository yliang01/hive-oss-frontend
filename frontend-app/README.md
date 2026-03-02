# OSS 管理前端 (Vite 构建)

源码目录，构建产物输出到 `../src/main/resources/static`，由 hive-oss 后端同源提供静态资源。

## 开发

```bash
npm install
npm run dev    # 开发服务器 http://localhost:3000
npm run build  # 构建到 static/
```

## 结构

- `index.html` / `pages/files.html`：多页入口
- `js/home.js`、`js/files.js`：页面逻辑（入口）
- `js/utils.js`：工具与通知
- `css/style.css`：全局样式（由入口 JS 引入）
- `public/`：构建时原样复制到 static 根目录
