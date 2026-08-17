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

文件详情中的预览字段由后端计算：

- `previewable=true` 时提供 `previewUrl` 和 `mimeType`；前端按 MIME 使用图片或文档弹窗展示。
- `thumbnailUrl` 仅在已有可读取缩略图时提供，图片网格优先使用它。
- `previewable=false` 时，`previewBlockedReason` 说明禁止原因。判定按以下顺序执行，命中首项即停止：
  - `ARCHIVE`：分类 `uiVariant=archive`，不提供在线预览。
  - `OSS_ONLY`：只有 OSS 对象，缺少解密所需文件名信息。
  - `FROZEN`：归档对象尚未解冻或有效期已过。
  - `TOO_LARGE`：文件大于 `hive.preview.max-size-bytes`，默认 10 MiB。
  - `UNSUPPORTED_TYPE`：扩展名不在预览白名单中。

主预览接口对 `FROZEN` 返回 `423 Locked`，对 `TOO_LARGE` 返回 `413 Payload Too Large`，其余禁止预览原因返回 `415 Unsupported Media Type`。该判定由服务端重复执行，不能仅依赖前端按钮状态。

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

解冻是向对象存储申请临时恢复归档对象，不会把文件下载到浏览器或 `hive.downloadDir`。仅 `storageClass=ARCHIVE` 的分类支持该接口；其他分类返回 `400 Bad Request`。

- `restorable=true` 表示归档对象当前不可读：`unfreezeTime` 为空或早于当前时间。前端仅在归档分类展示解冻时间和按钮，并以该字段控制按钮可用性。
- OSS 返回 `NOT_STARTED` 时，服务端发起 restore，写入 `unfreezeStatus=IN_PROGRESS`，返回 `202 Accepted`。
- OSS 返回 `IN_PROGRESS` 时，服务端保持轮询状态，返回 `202 Accepted`。
- OSS 返回 `COMPLETED` 时，服务端写入对象存储给出的有效期到 `unfreezeTime`，写入 `unfreezeStatus=COMPLETED`，返回 `200 OK`。在有效期内 `restorable=false`，可以创建下载任务。

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

`unfreezeStatus` 用于页面刷新后恢复 `IN_PROGRESS` 解冻任务的轮询，不作为解冻按钮或时间列的显示条件。

轮询返回 `202 Accepted` 表示仍在解冻；返回 `200 OK` 且 `status=COMPLETED` 表示可读取。若返回 `NOT_STARTED` 或 `FAILED`，前端停止轮询并提示用户重试。

### 12. 创建下载任务

`POST /categories/{category}/files/download-task/{fileKey}`

该接口启动服务端 OSS 下载和解密任务，不会向浏览器返回文件流或本地物理路径。无论前端按钮状态如何，服务端都按以下条件校验：

- 记录 `status` 必须为 `UPLOADED`；`UPLOADING`、`FAILED`、`OSS_ONLY`、`DB_ONLY`、`TO_BE_DELETED` 均不可下载。
- 归档分类的对象必须已解冻，即 `restorable=false`；冻结对象返回 `423 Locked`。
- `downloadStatus` 不能是 `downloading`，且目标本地副本不能已存在；任一情况返回 `409 Conflict`。
- 成功创建任务返回 `200 OK`。失败响应体包含 `{ "error": "..." }`，前端直接展示该消息。

服务端先检查过期任务：记录为 `downloading` 但内存中没有对应任务时，会删除遗留 `.part` 文件并将状态修正为 `failed`；同一次请求会继续创建新的下载任务。

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

下载任务开始后状态为 `downloading`，完成后为 `success`，失败后为 `failed`。文件列表中的 `downloadable` 是上述服务端资格规则的结果；`localFileAvailable` 则是后端根据下载目录实时计算的操作控制字段。其为 `true` 时前端允许释放本地副本并禁用再次下载；两个字段均不包含或展示物理路径。

### 14. 释放本地文件

`POST /categories/{category}/files/release-local/{fileKey}`

删除下载目录中的常规本地副本并清空下载任务状态；目标文件已不存在时仍按成功处理。目标路径不是常规文件时请求失败，避免误删目录或链接。

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
