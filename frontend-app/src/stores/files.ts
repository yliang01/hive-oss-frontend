import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import * as filesApi from '@/api/files'
import * as categoriesApi from '@/api/categories'
import type { FileItem, FilePage, Category, Group, DownloadState, UnfreezeState, GroupFilter } from '@/types'

const PAGE_SIZE = 50
const GROUP_FILTER_ALL = 'all'
const GROUP_FILTER_UNGROUPED = 'ungrouped'

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms))
}

export const useFilesStore = defineStore('files', () => {
  const category = ref('')
  const categoryMeta = ref<Category | null>(null)
  const groups = ref<Group[]>([])

  const files = ref<FileItem[]>([])
  const total = ref(0)
  const currentPage = ref(1)
  const keyword = ref('')
  const groupFilter = ref<GroupFilter>(GROUP_FILTER_ALL)
  const isLoading = ref(false)
  const viewMode = ref<'list' | 'grid'>('list')

  const selectedKeys = ref<Set<string>>(new Set())
  const downloadStates = ref<Map<string, DownloadState>>(new Map())
  const unfreezeStates = ref<Map<string, UnfreezeState>>(new Map())
  const taskRunId = ref(0)

  const totalPages = computed(() => Math.ceil(total.value / PAGE_SIZE))
  const hasPendingDelete = computed(() => files.value.some(f => f.status === 'TO_BE_DELETED'))
  const selectedList = computed(() => Array.from(selectedKeys.value))
  const isImageVariant = computed(() => categoryMeta.value?.uiVariant === 'image')
  const isArchiveVariant = computed(() => categoryMeta.value?.uiVariant === 'archive')

  const effectiveViewMode = computed(() => {
    if (isImageVariant.value) return 'grid'
    if (isArchiveVariant.value || categoryMeta.value?.uiVariant === 'file') return 'list'
    return viewMode.value
  })

  async function init(cat: string) {
    cleanupTasks()
    category.value = cat
    keyword.value = ''
    groupFilter.value = GROUP_FILTER_ALL
    currentPage.value = 1
    selectedKeys.value.clear()
    await Promise.all([loadMeta(), loadFiles(1)])
  }

  function cleanupTasks() {
    taskRunId.value++
    downloadStates.value.clear()
    unfreezeStates.value.clear()
  }

  async function loadMeta() {
    try {
      const [catRes, groupRes] = await Promise.all([
        categoriesApi.getCategories(),
        categoriesApi.getCategoryGroups(category.value),
      ])
      categoryMeta.value = catRes.data.find(c => c.code === category.value) || null
      groups.value = groupRes.data || []
    } catch (e: any) {
      ElMessage.error(e.response?.data?.error ?? '获取分类信息失败')
    }
  }

  async function loadFiles(page = 1) {
    if (!category.value) return
    currentPage.value = page
    isLoading.value = true
    try {
      const params: any = { page: page - 1, pageSize: PAGE_SIZE }
      if (keyword.value.trim()) params.keyword = keyword.value.trim()
      if (groupFilter.value === GROUP_FILTER_UNGROUPED) params.ungroupedOnly = true
      else if (groupFilter.value !== GROUP_FILTER_ALL) params.groupCode = groupFilter.value

      const res = await filesApi.listFiles(category.value, params)
      const data: FilePage = res.data
      files.value = data.files || []
      total.value = data.total || 0
      currentPage.value = (data.page ?? page - 1) + 1
      selectedKeys.value.clear()
      resumeActiveTasks()
    } catch (e: any) {
      ElMessage.error(e.response?.data?.error ?? '获取文件列表失败')
    } finally {
      isLoading.value = false
    }
  }

  async function refreshFiles(fileKeys: string[]) {
    const keys = Array.from(new Set(fileKeys.filter(Boolean)))
    if (!keys.length) return
    try {
      const res = await filesApi.batchGetFiles(category.value, keys)
      const latestByKey = new Map(res.data.map(file => [file.fileKey, file]))
      files.value = files.value.map(file => latestByKey.get(file.fileKey) || file)
    } catch {}
  }

  async function deleteFiles(fileKeys: string[]) {
    try {
      await filesApi.markDelete(category.value, fileKeys)
      ElMessage.success('删除操作已提交')
      await refreshFiles(fileKeys)
      selectedKeys.value.clear()
    } catch (e: any) {
      ElMessage.error(e.response?.data?.error ?? '删除失败')
    }
  }

  async function confirmDeleteAll() {
    const pendingKeys = files.value
      .filter(file => file.status === 'TO_BE_DELETED')
      .map(file => file.fileKey)
    if (!pendingKeys.length) {
      ElMessage.warning('当前列表没有等待执行删除的文件')
      return
    }
    try {
      await filesApi.confirmDelete(category.value, pendingKeys)
      ElMessage.success('确认删除成功')
      await loadFiles(currentPage.value)
    } catch (e: any) {
      ElMessage.error(e.response?.data?.error ?? '确认删除失败')
    }
  }

  async function cleanupLocal(fileKeys: string[]) {
    const keys = Array.from(new Set(fileKeys.filter(Boolean)))
    if (!keys.length) return
    try {
      await filesApi.cleanupLocal(category.value, keys)
      ElMessage.success('本地记录已清理')
      await loadFiles(currentPage.value)
    } catch (e: any) {
      ElMessage.error(e.response?.data?.error ?? '清理本地记录失败')
    }
  }

  async function syncRemote() {
    try {
      const res = await filesApi.syncRemote(category.value)
      const d = res.data
      ElMessage.success(`云端扫描完成！云端对象: ${d.ossTotal}, 仅云端: ${d.ossOnly}`)
      await Promise.all([loadMeta(), loadFiles(currentPage.value)])
    } catch (e: any) {
      ElMessage.error(e.response?.data?.error ?? '云端扫描失败')
      await loadMeta()
    }
  }

  async function refreshPage() {
    await Promise.all([loadMeta(), loadFiles(currentPage.value)])
  }

  async function downloadFile(fileKey: string) {
    const runId = taskRunId.value
    const taskCategory = category.value
    downloadStates.value.set(fileKey, { status: 'preparing' })
    try {
      await filesApi.createDownloadTask(taskCategory, fileKey)
      await pollDownload(taskCategory, fileKey, runId)
    } catch (e: any) {
      if (runId !== taskRunId.value) return
      downloadStates.value.set(fileKey, { status: 'failed' })
      ElMessage.error(e.response?.data?.error ?? '触发下载失败')
      setTimeout(() => downloadStates.value.delete(fileKey), 3000)
    }
  }

  async function pollDownload(taskCategory: string, fileKey: string, runId: number) {
    for (let i = 0; i < 120; i++) {
      await sleep(3000)
      if (runId !== taskRunId.value) return
      try {
        const res = await filesApi.getDownloadStatus(taskCategory, fileKey)
        if (runId !== taskRunId.value) return
        const d = res.data
        if (d.status === 'success') {
          downloadStates.value.set(fileKey, { status: 'done' })
          if (d.downloadUrl) triggerBrowserDownload(d.downloadUrl)
          setTimeout(() => {
            if (runId !== taskRunId.value) return
            downloadStates.value.delete(fileKey)
            loadFiles(currentPage.value)
          }, 1500)
          return
        }
        if (d.status === 'failed') {
          downloadStates.value.set(fileKey, { status: 'failed' })
          ElMessage.error('下载失败')
          setTimeout(() => downloadStates.value.delete(fileKey), 3000)
          return
        }
        downloadStates.value.set(fileKey, { status: 'downloading', progress: d.progress })
      } catch {}
    }
    downloadStates.value.set(fileKey, { status: 'failed' })
    ElMessage.error('下载超时，请重试')
    setTimeout(() => downloadStates.value.delete(fileKey), 3000)
  }

  async function unfreezeFile(fileKey: string) {
    const runId = taskRunId.value
    const taskCategory = category.value
    unfreezeStates.value.set(fileKey, { status: 'requesting' })
    try {
      const res = await filesApi.requestUnfreeze(taskCategory, fileKey)
      if (runId !== taskRunId.value) return
      if (res.data?.status === 'COMPLETED') {
        unfreezeStates.value.set(fileKey, { status: 'done' })
        ElMessage.success('文件解冻成功')
        setTimeout(() => {
          if (runId !== taskRunId.value) return
          unfreezeStates.value.delete(fileKey)
          refreshFiles([fileKey])
        }, 1000)
      } else if (res.data?.status === 'IN_PROGRESS') {
        unfreezeStates.value.set(fileKey, { status: 'polling' })
        await pollUnfreeze(taskCategory, fileKey, runId)
      } else {
        throw new Error(`解冻请求失败: ${res.status}`)
      }
    } catch (e: any) {
      if (runId !== taskRunId.value) return
      unfreezeStates.value.delete(fileKey)
      ElMessage.error(e.response?.data?.error ?? e.message ?? '解冻失败')
    }
  }

  async function pollUnfreeze(taskCategory: string, fileKey: string, runId: number) {
    for (let i = 0; i < 60; i++) {
      await sleep(3000)
      if (runId !== taskRunId.value) return
      try {
        const res = await filesApi.getUnfreezeStatus(taskCategory, fileKey)
        if (runId !== taskRunId.value) return
        if (res.data?.status === 'COMPLETED') {
          unfreezeStates.value.set(fileKey, { status: 'done' })
          ElMessage.success('文件解冻完成')
          setTimeout(() => {
            if (runId !== taskRunId.value) return
            unfreezeStates.value.delete(fileKey)
            refreshFiles([fileKey])
          }, 1000)
          return
        }
        if (res.data?.status === 'NOT_STARTED' || res.data?.status === 'FAILED') {
          unfreezeStates.value.delete(fileKey)
          ElMessage.error('解冻状态异常，请重试')
          return
        }
      } catch {}
    }
    unfreezeStates.value.delete(fileKey)
    ElMessage.error('解冻超时，请稍后重试')
  }

  async function releaseLocal(fileKey: string) {
    try {
      await filesApi.releaseLocal(category.value, fileKey)
      ElMessage.success('本地文件已释放')
      await refreshFiles([fileKey])
    } catch (e: any) {
      ElMessage.error(e.response?.data?.error ?? '释放失败')
    }
  }

  async function assignToGroup(targetGroupCode: string) {
    if (!selectedKeys.value.size) { ElMessage.warning('请先勾选文件'); return }
    try {
      await filesApi.assignFilesToGroup(category.value, targetGroupCode, selectedList.value)
      ElMessage.success('批量分配成功')
      selectedKeys.value.clear()
      await loadFiles(1)
    } catch (e: any) {
      ElMessage.error(e.response?.data?.error ?? '批量分配失败')
    }
  }

  function toggleSelect(fileKey: string, checked: boolean) {
    if (checked) selectedKeys.value.add(fileKey)
    else selectedKeys.value.delete(fileKey)
  }

  function setViewMode(mode: 'list' | 'grid') {
    viewMode.value = mode
    if (mode !== 'grid') selectedKeys.value.clear()
  }

  function setKeyword(kw: string) {
    keyword.value = kw
    loadFiles(1)
  }

  function setGroupFilter(filter: GroupFilter) {
    groupFilter.value = filter || GROUP_FILTER_ALL
    loadFiles(1)
  }

  function resumeActiveTasks() {
    const runId = taskRunId.value
    const taskCategory = category.value
    for (const file of files.value) {
      if (file.downloadStatus === 'downloading' && !downloadStates.value.has(file.fileKey)) {
        downloadStates.value.set(file.fileKey, { status: 'downloading', progress: file.downloadProgress })
        void pollDownload(taskCategory, file.fileKey, runId)
      }
      if (file.unfreezeStatus === 'IN_PROGRESS' && !unfreezeStates.value.has(file.fileKey)) {
        unfreezeStates.value.set(file.fileKey, { status: 'polling' })
        void pollUnfreeze(taskCategory, file.fileKey, runId)
      }
    }
  }

  return {
    category, categoryMeta, groups,
    files, total, currentPage, keyword, groupFilter, isLoading, viewMode,
    selectedKeys, downloadStates, unfreezeStates,
    totalPages, hasPendingDelete, selectedList, isImageVariant, isArchiveVariant, effectiveViewMode,
    init, loadFiles, loadMeta, refreshFiles,
    deleteFiles, confirmDeleteAll, cleanupLocal, syncRemote, refreshPage,
    downloadFile, unfreezeFile, releaseLocal, assignToGroup,
    toggleSelect, setViewMode, setKeyword, setGroupFilter, cleanupTasks,
  }
})

function triggerBrowserDownload(url: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = ''
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => document.body.removeChild(a), 100)
}
