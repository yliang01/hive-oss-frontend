# OSS 管理前端 API 接口文档（全数据化分类版）

## 基础信息

- 基础 URL: `http://localhost:8080`
- 内容类型: `application/json`
- 分类来源: `file_category` 表（动态维护）

## 分类与分组

### 1. 获取分类列表

`GET /categories`

### 2. 获取分类下分组列表

`GET /categories/{category}/groups`

### 3. 分组分配文件

`POST /categories/{category}/groups/{groupId}/files:assign`

请求体：

```json
{
  "fileKeys": ["key1", "key2"],
  "operator": "admin"
}
```

### 4. 分组迁移文件

`POST /categories/{category}/groups/{groupId}/files:move`

请求体同上。

> Deprecated：该接口为兼容别名，前端统一使用 `files:assign`。

## 分类/分组管理（管理员）

### A1. 分类列表（管理端）

`GET /category-admin/categories`

### A2. 创建分类

`POST /category-admin/categories`

### A3. 更新分类

`PUT /category-admin/categories/{categoryCode}`

### A4. 停用分类

`POST /category-admin/categories/{categoryCode}/disable`

### A5. 删除分类

`DELETE /category-admin/categories/{categoryCode}`

### A6. 查询分类下分组（管理端）

`GET /category-admin/categories/{categoryCode}/groups`

### A7. 创建分组

`POST /category-admin/categories/{categoryCode}/groups`

### A8. 更新分组

`PUT /category-admin/categories/{categoryCode}/groups/{groupId}`

### A9. 删除分组

`DELETE /category-admin/categories/{categoryCode}/groups/{groupId}`

## 文件管理

### 5. 获取文件列表

`GET /categories/{category}/files?page=0&pageSize=50&groupId=1`

`groupId` 可选，不传则为分类内全部文件。

`keyword` 可选，传入后按文件名模糊搜索，例如：

`GET /categories/{category}/files?page=0&pageSize=50&groupId=1&keyword=abc`

### 6. 搜索文件

`GET /categories/{category}/files/search?keyword=abc&page=0&pageSize=50&groupId=1`

> Deprecated：兼容接口。建议统一使用 `GET /categories/{category}/files` 并通过 `keyword` 查询参数搜索。

### 7. 获取单个文件

`GET /categories/{category}/files/{fileKey}`

### 8. 预览文件

`GET /categories/{category}/files/preview/{fileKey}`

说明：前端通过文件详情中的 `previewUrl` 字段间接访问该地址（`img/iframe src`），不是 `fetch/xhr` 显式调用。

### 9. 删除文件

`DELETE /categories/{category}/files/{fileKey}`

### 10. 解冻文件

`POST /categories/{category}/files/unfreeze/{fileKey}`

### 11. 查询解冻状态

`GET /categories/{category}/files/unfreeze-status/{fileKey}`

### 12. 创建下载任务

`POST /categories/{category}/files/download-task/{fileKey}`

### 13. 查询下载任务状态

`GET /categories/{category}/files/download-task-status/{fileKey}`

响应体示例：

```json
{
  "status": "success",
  "progress": 100,
  "downloadUrl": "file:///C:/data/hive/download/example.txt"
}
```

### 14. 释放本地文件

`POST /categories/{category}/files/release-local/{fileKey}`

### 15. 上传文件

`POST /categories/{category}/files/upload` (`multipart/form-data`)

## 同步能力

### 16. 确认删除

`POST /categories/{category}/files/confirm-delete`

### 17. 远程同步

`POST /categories/{category}/files/sync-remote`

## 数据库备份与恢复（保持不变）

- `POST /db-backup/backup`
- `GET /db-backup/ack/{batchId}`
- `GET /db-backup/backups`
- `POST /db-backup/restore/{batchId}`

## SQL 交付文件（手工执行）

- `hive-oss/docs/modules/001_category_group_schema.sql`
- `hive-oss/docs/modules/002_category_seed.sql`
- `hive-oss/docs/modules/003_index_and_constraints.sql`
- `hive-oss/docs/modules/004_safe_cleanup.sql`

