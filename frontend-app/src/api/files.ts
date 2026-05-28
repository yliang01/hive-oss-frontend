import client from './client'
import type { FileItem, FilePage, SyncResult, DownloadTaskStatus, UnfreezeTaskStatus } from '@/types'

export const listFiles = (category: string, params: {
  page: number
  pageSize: number
  groupCode?: string
  ungroupedOnly?: boolean
  keyword?: string
}) => client.get<FilePage>(`/categories/${category}/files`, { params })

export const batchGetFiles = (category: string, fileKeys: string[]) => {
  const params = new URLSearchParams()
  fileKeys.forEach(key => params.append('fileKeys', key))
  return client.get<FileItem[]>(`/categories/${category}/files:batch-get`, { params })
}

export const checkUpload = (category: string, fileName: string) =>
  client.post<{ exists: boolean; fileKey?: string }>(
    `/categories/${category}/files/upload/check`,
    { fileName },
    { validateStatus: s => s < 500 }
  )

export const markDelete = (category: string, fileKeys: string[]) =>
  client.post(`/categories/${category}/files:mark-delete`, { fileKeys })

export const confirmDelete = (category: string) =>
  client.post(`/categories/${category}/files/confirm-delete`)

export const syncRemote = (category: string) =>
  client.post<SyncResult>(`/categories/${category}/files/sync-remote`)

export const createDownloadTask = (category: string, fileKey: string) =>
  client.post(`/categories/${category}/files/download-task/${fileKey}`)

export const getDownloadStatus = (category: string, fileKey: string) =>
  client.get<DownloadTaskStatus>(`/categories/${category}/files/download-task-status/${fileKey}`)

export const requestUnfreeze = (category: string, fileKey: string) =>
  client.post<UnfreezeTaskStatus>(`/categories/${category}/files/unfreeze/${fileKey}`, null, { validateStatus: s => s < 500 })

export const getUnfreezeStatus = (category: string, fileKey: string) =>
  client.get<UnfreezeTaskStatus>(`/categories/${category}/files/unfreeze-status/${fileKey}`, { validateStatus: s => s < 500 })

export const releaseLocal = (category: string, fileKey: string) =>
  client.post(`/categories/${category}/files/release-local/${fileKey}`)

export const assignFilesToGroup = (category: string, groupCode: string, fileKeys: string[]) =>
  client.post(`/categories/${category}/groups/${groupCode}/files:assign`, { fileKeys, operator: 'ui' })

export const uploadFile = (
  category: string,
  file: File,
  onProgress?: (percent: number) => void
) => {
  const formData = new FormData()
  formData.append('file', file)
  return client.post<{ fileKey: string }>(`/categories/${category}/files/upload`, formData, {
    timeout: 0,
    onUploadProgress: (e) => {
      if (e.total && onProgress) {
        onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)))
      }
    },
  })
}
