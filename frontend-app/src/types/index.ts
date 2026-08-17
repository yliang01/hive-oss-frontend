export interface Category {
  code: string
  name: string
  bucketName: string
  storageClass: string
  enabled: boolean
  sortOrder: number
  uiVariant: 'image' | 'archive' | 'file'
  lastSyncTime?: string
  lastSyncStatus?: 'SUCCESS' | 'FAILED'
  lastSyncOssTotal?: number
  lastSyncOssOnly?: number
  lastSyncOssToDbMatched?: number
  lastSyncOssToDbMismatched?: number
  lastSyncDbToOssMismatched?: number
  lastSyncSkipped?: number
  lastSyncMessage?: string
}

export interface Group {
  groupCode: string
  groupName: string
  sortOrder: number
}

export interface FileItem {
  fileKey: string
  fileName: string
  size: number
  originalSize?: number
  status: string
  updateTime: string
  unfreezeTime?: string
  unfreezeStatus?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  groupName?: string
  groupCode?: string
  previewable: boolean
  previewUrl?: string
  previewBlockedReason?: 'ARCHIVE' | 'LOCAL_MISSING' | 'ZIP_ARCHIVE' | 'RECORD_NOT_READY' | 'TOO_LARGE' | 'UNSUPPORTED_TYPE' | 'OSS_ONLY'
  thumbnailUrl?: string
  restorable: boolean
  downloadable: boolean
  downloadStatus?: 'success' | 'failed' | 'downloading'
  downloadProgress?: number
  localFileAvailable: boolean
  deletable: boolean
  localCheckStatus?: 'SIZE_MATCHED' | 'SIZE_CHANGED' | 'MISSING' | 'BASELINE_MISSING' | 'UNVERIFIABLE'
  localCheckObservedSize?: number
  mimeType?: string
}

export interface FilePage {
  files: FileItem[]
  total: number
  page: number
  pageSize: number
}

export interface BackupItem {
  batchId: string
  database: string
  status: string
  createdAt: string
  message?: string
}

export interface BackupAck {
  batchId?: string
  status: string
  message?: string
}

export interface DownloadTaskStatus {
  status: 'success' | 'failed' | 'downloading'
  progress?: number
}

export interface UnfreezeTaskStatus {
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  unfreezeTime?: string
}

export interface SyncResult {
  status?: 'SUCCESS' | 'FAILED'
  syncedAt?: string
  message?: string
  ossTotal: number
  ossOnly: number
  ossToDbMatched: number
  ossToDbMismatched: number
  dbToOssMismatched: number
  skipped: number
}

export interface LocalReuploadStart {
  taskId: string
  status: 'RUNNING'
}

export interface LocalReuploadTaskStatus {
  taskId: string
  fileKey: string
  status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'UNKNOWN'
  message?: string
}

export type TaskState = 'idle' | 'running' | 'success' | 'failed' | 'restart-needed'

export interface TaskStatus {
  taskType: 'BACKUP' | 'RESTORE'
  batchId: string
  phase: string
  detail?: string
  pollAttempts: number
  elapsedSeconds: number
  state: TaskState
}

export type DownloadState = {
  status: 'idle' | 'preparing' | 'downloading' | 'done' | 'failed'
  progress?: number
}

export type UnfreezeState = {
  status: 'idle' | 'requesting' | 'polling' | 'done' | 'failed'
}

export type ReuploadState = {
  status: 'idle' | 'requesting' | 'running' | 'done' | 'failed' | 'unknown'
  taskId?: string
  message?: string
}

export type GroupFilter = 'all' | 'ungrouped' | string
