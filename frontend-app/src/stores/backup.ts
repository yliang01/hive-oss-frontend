import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import * as backupApi from '@/api/backup'
import type { BackupItem, TaskStatus } from '@/types'

const PHASE: Record<string, string> = {
  SUBMITTING: '提交任务中',
  PENDING: '任务处理中',
  UPLOADED: '备份已上传到 OSS',
  RESTORED: '恢复已完成',
  RESTART_NEEDED: '需要重启应用',
  FAILED: '任务失败',
  TIMEOUT: '状态查询超时',
}

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms))
}

export const useBackupStore = defineStore('backup', () => {
  const backupList = ref<BackupItem[]>([])
  const taskStatus = ref<TaskStatus | null>(null)
  const isBackupRunning = ref(false)
  const isRestoreRunning = ref(false)
  const isDeleteRunning = ref(false)
  const isLoading = ref(false)
  const isCheckingRestartedRestore = ref(false)

  const actionsDisabled = computed(() =>
    isRestoreRunning.value || isDeleteRunning.value || taskStatus.value?.state === 'restart-needed'
  )

  async function loadBackupList() {
    isLoading.value = true
    try {
      const res = await backupApi.listBackups()
      backupList.value = (res.data.items || []).slice().sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    } catch (e: any) {
      ElMessage.error(e.response?.data?.error ?? '获取备份列表失败')
    } finally {
      isLoading.value = false
    }
  }

  async function startBackup() {
    if (isBackupRunning.value) return
    isBackupRunning.value = true
    const startedAt = Date.now()
    taskStatus.value = { taskType: 'BACKUP', batchId: '-', phase: PHASE.SUBMITTING, pollAttempts: 0, elapsedSeconds: 0, state: 'running' }

    try {
      const res = await backupApi.triggerBackup()
      const { batchId, message } = res.data
      taskStatus.value = {
        taskType: 'BACKUP', batchId, phase: PHASE.PENDING,
        detail: message || '备份任务已受理，等待上传完成',
        pollAttempts: 0, elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000), state: 'running',
      }
      await pollAck(batchId, startedAt, 'BACKUP')
      ElMessage.success('备份已上传至 OSS')
      await loadBackupList()
    } catch (e: any) {
      const msg = e.response?.data?.error ?? e.message ?? '触发备份失败'
      ElMessage.error(msg)
      if (taskStatus.value) {
        taskStatus.value = { ...taskStatus.value, phase: PHASE.FAILED, detail: msg, elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000), state: 'failed' }
      }
    } finally {
      isBackupRunning.value = false
    }
  }

  async function startRestore(batchId: string) {
    if (actionsDisabled.value) return
    isRestoreRunning.value = true
    const startedAt = Date.now()
    taskStatus.value = { taskType: 'RESTORE', batchId, phase: PHASE.SUBMITTING, pollAttempts: 0, elapsedSeconds: 0, state: 'running' }

    try {
      const res = await backupApi.triggerRestore(batchId)
      const data = res.data
      const initStatus = (data?.status || 'PENDING').toUpperCase()
      taskStatus.value = {
        taskType: 'RESTORE', batchId,
        phase: PHASE[initStatus] || PHASE.PENDING,
        detail: data?.message || '',
        pollAttempts: 0, elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000), state: 'running',
      }
      await pollAck(batchId, startedAt, 'RESTORE')
      if (taskStatus.value?.state === 'restart-needed') return
      ElMessage.success('数据库已恢复')
      await loadBackupList()
    } catch (e: any) {
      const msg = e.response?.data?.error ?? e.message ?? '触发恢复失败'
      ElMessage.error(msg)
      if (taskStatus.value) {
        taskStatus.value = { ...taskStatus.value, phase: PHASE.FAILED, detail: msg, elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000), state: 'failed' }
      }
    } finally {
      isRestoreRunning.value = false
    }
  }

  async function deleteBackup(batchId: string) {
    if (actionsDisabled.value) return
    isDeleteRunning.value = true
    try {
      await backupApi.deleteBackup(batchId)
      ElMessage.success('备份删除成功')
      await loadBackupList()
    } catch (e: any) {
      ElMessage.error(e.response?.data?.error ?? e.message ?? '删除备份失败')
    } finally {
      isDeleteRunning.value = false
    }
  }

  async function pollAck(batchId: string, startedAt: number, taskType: 'BACKUP' | 'RESTORE') {
    const max = 300
    for (let i = 1; i <= max; i++) {
      await sleep(2000)
      const elapsed = Math.floor((Date.now() - startedAt) / 1000)
      try {
        const res = await backupApi.getBackupAck(batchId)
        const status = (res.data?.status || 'PENDING').toUpperCase()
        const isRestartNeeded = status === 'RESTART_NEEDED'
        const state: TaskStatus['state'] =
          status === 'UPLOADED' || status === 'RESTORED' ? 'success' :
          status === 'FAILED' ? 'failed' :
          isRestartNeeded ? 'restart-needed' : 'running'

        taskStatus.value = {
          taskType, batchId, phase: PHASE[status] || PHASE.PENDING,
          detail: res.data?.message || '',
          pollAttempts: i, elapsedSeconds: elapsed, state,
        }

        if (status === 'UPLOADED' || status === 'RESTORED') return
        if (status === 'FAILED') throw new Error(res.data?.message || '任务失败')
        if (isRestartNeeded) {
          ElMessage.warning(res.data?.message || 'H2 恢复已准备好，请重启应用完成恢复')
          return
        }
      } catch (e: any) {
        if (taskStatus.value) {
          taskStatus.value = { ...taskStatus.value, detail: '状态查询失败，正在重试', pollAttempts: i, elapsedSeconds: elapsed }
        }
        if (i >= max) throw e
      }
    }
    throw new Error('轮询超时，请稍后手动确认结果')
  }

  async function checkRestartedRestore() {
    const pendingRestore = taskStatus.value
    if (pendingRestore?.taskType !== 'RESTORE'
      || pendingRestore.state !== 'restart-needed'
      || isCheckingRestartedRestore.value) return

    isCheckingRestartedRestore.value = true
    try {
      const res = await backupApi.getBackupAck(pendingRestore.batchId)
      const status = (res.data?.status || '').toUpperCase()
      // After restart the in-memory tracker is gone; a ready business API means startup applied the pending H2 restore.
      if (status === 'UPLOADED' || status === 'RESTORED') {
        taskStatus.value = {
          ...pendingRestore,
          phase: PHASE.RESTORED,
          detail: '后端已重启，H2 备份已应用',
          state: 'success',
        }
        ElMessage.success('H2 数据库恢复已应用')
        await loadBackupList()
      }
    } catch {
      // Keep waiting while the backend is restarting or business APIs are unavailable.
    } finally {
      isCheckingRestartedRestore.value = false
    }
  }

  return {
    backupList, taskStatus, isBackupRunning, isRestoreRunning, isDeleteRunning, isLoading,
    actionsDisabled, loadBackupList, startBackup, startRestore, deleteBackup, checkRestartedRestore,
  }
})
