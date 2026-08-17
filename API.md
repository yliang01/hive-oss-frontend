# OSS 管理前端 API 接口文档（全数据化分类版）

## 基础信息

- 基础 URL: `http://localhost:8080`
- 内容类型: `application/json`
- 分类来源: `file_category` 表（动态维护）

## 分类与分组

### 1. 获取分类列表

`GET /categories`

分类对象包含上次远端同步摘要字段：`lastSyncTime`、`lastSyncStatus`、`lastSyncOssTotal`、`lastSyncOssOnly`、`lastSyncOssToDbMatched`、`lastSyncOssToDbMismatched`、`lastSyncDbToOssMismatched`、`lastSyncMessage`。

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

若任一文件存在本地下载副本、本地源文件，或正在下载，分组分配返回 `409 Conflict`。请先释放本地副本、移走本地源文件或等待下载结束。

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

分组内任一文件存在本地下载副本、本地源文件，或正在下载时，删除分组返回 `409 Conflict`。

## 文件管理

### 5. 获取文件列表

`GET /categories/{category}/files?page=0&pageSize=50&groupId=1`

`groupId` 可选，不传则为分类内全部文件。

`keyword` 可选，传入后按文件名模糊搜索，例如：

`GET /categories/{category}/files?page=0&pageSize=50&groupId=1&keyword=abc`

### 6. 搜索文件

`GET /categories/{category}/files/search?keyword=abc&page=0&pageSize=50&groupId=1`

> Deprecated：兼容接口。建议统一使用 `GET /categories/{category}/files` 并通过 `keyword` 查询参数搜索。

### 7. 批量获取文件详情

`GET /categories/{category}/files:batch-get?fileKeys=key1&fileKeys=key2`

说明：前端在标记删除、解冻、下载、本地释放等操作后，用该接口按 `fileKey` 批量刷新当前列表中的记录状态。旧的单文件详情接口 `GET /categories/{category}/files/{fileKey}` 已下线。

文件列表和批量详情会即时检查返回记录在 `hive.localScanDir` 中的本地源文件，响应中的 `localCheckStatus`、`localCheckObservedSize` 不会持久化或缓存。

### 8. 预览文件

`GET /categories/{category}/files/preview/{fileKey}`

说明：前端通过文件详情中的 `previewUrl` 字段间接访问该地址（`img/iframe src`），不是 `fetch/xhr` 显式调用。

### 9. 标记删除文件

`POST /categories/{category}/files:mark-delete`

请求体：

```json
{
  "fileKeys": ["key1", "key2"]
}
```

说明：前端统一通过选中文件后批量标记删除，不再使用单文件 DELETE 接口。

### 10. 解冻文件

`POST /categories/{category}/files/unfreeze/{fileKey}`

响应体示例：

```json
{
  "status": "IN_PROGRESS",
  "unfreezeTime": null
}
```

### 11. 查询解冻状态

`GET /categories/{category}/files/unfreeze-status/{fileKey}`

响应体示例：

```json
{
  "status": "COMPLETED",
  "unfreezeTime": "2026-05-27T10:00:00"
}
```

### 12. 创建下载任务

`POST /categories/{category}/files/download-task/{fileKey}`

目标本地副本已存在时返回 `409 Conflict`，需先释放本地副本。

下载副本按 `{downloadDir}/{categoryCode}/{groupCode 或 _ungrouped}/{fileName}[.zip]` 落盘。旧版平铺下载文件不会自动迁移。

### 13. 查询下载任务状态

`GET /categories/{category}/files/download-task-status/{fileKey}`

响应体示例：

```json
{
  "status": "success",
  "progress": 100
}
```

`success` 仅表示服务端下载任务完成，不返回下载目录中的物理路径或文件存在状态。

文件列表中的 `localFileAvailable` 是后端根据下载目录实时计算的操作控制字段：为 `true` 时前端允许释放本地副本并禁用再次下载。该字段不包含或展示物理路径。

### 14. 释放本地文件

`POST /categories/{category}/files/release-local/{fileKey}`

删除下载目录中的本地副本并清空下载任务状态；目标文件已不存在时仍按成功处理。

下载任务进行中时返回 `409 Conflict`。

### 15. 上传文件

`POST /categories/{category}/files/upload` (`multipart/form-data`)

### 本地重新上传

`POST /categories/{category}/files:reupload-local`

请求体：

```json
{
  "fileKey": "key1"
}
```

后端会重新检查本地源文件，仅大小已变或未建立大小基线的文件可以重新上传。

## 同步能力

### 16. 确认删除已标记文件

`POST /categories/{category}/files/confirm-delete`

### 17. 远程同步

`POST /categories/{category}/files/sync-remote`

响应体：

```json
{
  "status": "SUCCESS",
  "syncedAt": "2026-05-27T19:30:00",
  "ossTotal": 123,
  "ossOnly": 4,
  "ossToDbMatched": 118,
  "ossToDbMismatched": 1,
  "dbToOssMismatched": 0
}
```

同步摘要会持久化到分类记录；页面刷新通过 `GET /categories` 读取上次同步结果。

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

Restore status schema changes are managed by Flyway under `hive-oss/src/main/resources/db/migration/`.
