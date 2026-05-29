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
  status: string
  updateTime: string
  unfreezeTime?: string
  unfreezeStatus?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  groupName?: string
  groupCode?: string
  previewable: boolean
  previewUrl?: string
  previewBlockedReason?: 'FROZEN' | 'TOO_LARGE' | 'UNSUPPORTED_TYPE' | 'OSS_ONLY'
  thumbnailUrl?: string
  thumbStatus?: 'PENDING'
  restorable: boolean
  downloadable: boolean
  downloadStatus?: 'success' | 'failed' | 'downloading'
  downloadProgress?: number
  deletable: boolean
  localPath?: string
  localPathExists?: boolean
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
  downloadUrl?: string
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

export type GroupFilter = 'all' | 'ungrouped' | string
