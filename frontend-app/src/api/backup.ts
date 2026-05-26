import client from './client'
import type { BackupItem, BackupAck } from '@/types'

export const triggerBackup = () =>
  client.post<{ batchId: string; message?: string }>('/db-backup/backup')

export const getBackupAck = (batchId: string) =>
  client.get<BackupAck>(`/db-backup/ack/${encodeURIComponent(batchId)}`)

export const listBackups = () =>
  client.get<{ items: BackupItem[] }>('/db-backup/backups')

export const deleteBackup = (batchId: string) =>
  client.delete(`/db-backup/${encodeURIComponent(batchId)}`)

export const triggerRestore = (batchId: string) =>
  client.post<BackupAck>(`/db-backup/restore/${encodeURIComponent(batchId)}`)
