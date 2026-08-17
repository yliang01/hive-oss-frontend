<template>
  <div class="files-page ops-page">
    <div class="files-container ops-container">
      <header class="ops-hero files-hero">
        <div>
          <el-button class="back-button" text @click="router.push('/')">
            <el-icon><ArrowLeft /></el-icon>返回控制台
          </el-button>
          <div class="ops-kicker">Object Browser</div>
          <h1 class="ops-title">{{ store.categoryMeta?.name || store.category }}</h1>
          <p class="ops-subtitle">
            <el-tag size="small" type="info" effect="plain">{{ variantLabel(store.categoryMeta?.uiVariant) }}</el-tag>
            <span>共 {{ store.total }} 个对象，当前第 {{ store.currentPage }} 页</span>
          </p>
        </div>
        <div class="hero-side">
          <div class="hero-actions">
            <el-button type="primary" size="large" @click="uploadVisible = true">
              <el-icon><Upload /></el-icon>上传文件
            </el-button>
            <el-button size="large" :loading="syncLoading" @click="doSync">
              <el-icon><Refresh /></el-icon>扫描云端
            </el-button>
          </div>

          <div class="sync-compact" :class="syncStatusClass">
            <span class="sync-dot" />
            <div class="sync-copy">
              <div class="sync-compact-title">{{ syncCompactTitle }}</div>
              <div v-if="syncChartSegments.length" class="sync-bars" aria-label="云端扫描结果分布">
                <span
                  v-for="segment in syncChartSegments"
                  :key="segment.key"
                  class="sync-bar-segment"
                  :class="`sync-bar-segment--${segment.key}`"
                  :style="{ width: `${segment.percent}%` }"
                  :title="`${segment.label} ${segment.value} (${segment.percent}%)`"
                />
              </div>
              <div class="sync-compact-meta">{{ syncCompactMeta }}</div>
            </div>
            <el-popover placement="bottom-end" trigger="click" width="320">
              <template #reference>
                <el-button link size="small">详情</el-button>
              </template>
              <div class="sync-detail-list">
                <div v-for="row in syncDetailRows" :key="row.label" class="sync-detail-row">
                  <span>{{ row.label }}</span>
                  <strong>{{ row.value }}</strong>
                </div>
                <template v-if="syncChartRows.length">
                  <div class="sync-detail-bars" aria-label="云端扫描结果分布详情">
                    <span
                      v-for="segment in syncChartSegments"
                      :key="segment.key"
                      class="sync-bar-segment"
                      :class="`sync-bar-segment--${segment.key}`"
                      :style="{ width: `${segment.percent}%` }"
                    />
                  </div>
                  <div v-for="row in syncChartRows" :key="row.key" class="sync-detail-row sync-detail-row--metric">
                    <span><i class="sync-metric-dot" :class="`sync-metric-dot--${row.key}`" />{{ row.label }}</span>
                    <strong>{{ row.value }} <small>{{ row.percent }}%</small></strong>
                  </div>
                </template>
              </div>
            </el-popover>
          </div>

        </div>
      </header>

      <div class="toolbar">
        <div class="toolbar-filter">
          <el-input
            v-model="searchInput"
            placeholder="搜索文件名..."
            clearable
            class="search-input"
            @keyup.enter="doSearch"
            @clear="doSearch"
          >
            <template #append>
              <el-button :icon="Search" @click="doSearch" />
            </template>
          </el-input>

          <el-select
            v-model="groupFilter"
            placeholder="全部文件"
            class="group-select"
            @change="onGroupChange"
          >
            <el-option label="全部文件" value="all" />
            <el-option label="未分组" value="ungrouped" />
            <el-option v-for="g in store.groups" :key="g.groupCode" :label="g.groupName" :value="g.groupCode" />
          </el-select>

          <el-button class="new-group-button" @click="goCreateGroup">
            <el-icon><Connection /></el-icon>新建分组
          </el-button>
        </div>

        <div class="toolbar-actions">
          <el-button-group v-if="!store.isImageVariant && !store.isArchiveVariant && store.categoryMeta?.uiVariant !== 'file'">
            <el-button :type="store.effectiveViewMode === 'list' ? 'primary' : ''" size="small" @click="store.setViewMode('list')">
              <el-icon><List /></el-icon>
            </el-button>
            <el-button :type="store.effectiveViewMode === 'grid' ? 'primary' : ''" size="small" @click="store.setViewMode('grid')">
              <el-icon><Grid /></el-icon>
            </el-button>
          </el-button-group>

          <el-badge :value="store.selectedKeys.size || ''" :hidden="!store.selectedKeys.size">
            <el-button size="small" :disabled="!store.selectedKeys.size" @click="openAssign">
              <el-icon><Connection /></el-icon>分配分组
            </el-button>
          </el-badge>

          <el-button size="small" type="danger" plain :disabled="!selectedDeletableKeys.length" @click="deleteSelected">
            <el-icon><Delete /></el-icon>标记删除
          </el-button>

          <el-button size="small" :disabled="!store.hasPendingDelete" title="执行删除已标记文件" @click="confirmDeleteAll">
            <el-icon><Check /></el-icon>执行删除
          </el-button>

          <el-button size="small" :loading="store.isLoading" @click="store.refreshPage()">
            <el-icon><RefreshRight /></el-icon>刷新列表
          </el-button>
        </div>
      </div>

      <!-- 文件列表 (list 视图) -->
      <div v-if="store.effectiveViewMode === 'list'" class="list-section">
        <el-table
          :data="store.files"
          v-loading="store.isLoading"
          size="small"
          stripe
          style="width: 100%"
          @selection-change="onSelectionChange"
        >
          <el-table-column type="expand" width="32">
            <template #default="{ row }">
              <div class="expand-panel">
                <div class="expand-item">
                  <label>文件名</label>
                  <div class="expand-value mono">{{ row.fileName }}</div>
                  <el-button size="small" @click="copy(row.fileName)">复制文件名</el-button>
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column type="selection" width="40" />

          <el-table-column label="文件名" min-width="160">
            <template #default="{ row }">
              <HighlightedText :title="row.fileName" class="truncated-name" :text="row.fileName" :keyword="store.keyword" />
            </template>
          </el-table-column>

          <el-table-column label="云端存储大小" width="120" :formatter="(r) => formatSize(r.size)" />
          <el-table-column label="同步状态" width="140">
            <template #default="{ row }">
              <el-tag size="small" :type="statusTagType(row.status)" effect="plain">{{ statusLabel(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="本地校验" width="140">
            <template #default="{ row }">
              <el-tooltip :content="localCheckTip(row)" placement="top">
                <el-tag size="small" :type="localCheckTagType(row)" effect="plain">{{ localCheckLabel(row) }}</el-tag>
              </el-tooltip>
            </template>
          </el-table-column>
          <el-table-column label="删除策略" width="110">
            <template #default="{ row }">
              <el-tag size="small" :type="row.deletable ? 'warning' : 'info'" effect="plain">
                {{ row.deletable ? '可标记删除' : '受保护' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="分组" width="120">
            <template #default="{ row }">
              <el-tag size="small" :type="row.groupCode ? 'primary' : 'info'" effect="plain">
                {{ row.groupName || '未分组' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="更新时间" width="140" :formatter="(r) => formatDate(r.updateTime)" />
          <el-table-column label="解冻时间" width="140">
            <template #default="{ row }">{{ row.unfreezeTime ? formatDate(row.unfreezeTime) : '-' }}</template>
          </el-table-column>
          <el-table-column label="操作" width="280" fixed="right">
            <template #default="{ row }">
              <div class="action-cell">
                <div class="action-row">
                  <!-- 解冻 -->
                  <el-button
                    link
                    size="small"
                    :disabled="!row.restorable || unfreezeState(row.fileKey).status !== 'idle'"
                    :loading="['requesting','polling'].includes(unfreezeState(row.fileKey).status)"
                    @click="store.unfreezeFile(row.fileKey)"
                  >
                    {{ unfreezeLabel(row.fileKey) }}
                  </el-button>

                  <!-- 下载 -->
                  <el-button
                    link
                    size="small"
                    :disabled="row.downloadable === false || dlState(row.fileKey).status !== 'idle'"
                    :loading="['preparing','downloading'].includes(dlState(row.fileKey).status)"
                    @click="store.downloadFile(row.fileKey)"
                  >
                    {{ dlLabel(row.fileKey) }}
                  </el-button>
                  <el-button
                    v-if="row.localFileAvailable && row.downloadStatus !== 'downloading'"
                    link
                    size="small"
                    type="warning"
                    @click="confirmRelease(row.fileKey)"
                  >释放本地</el-button>

                  <!-- 预览 -->
                  <el-button
                    v-if="store.categoryMeta?.uiVariant !== 'archive'"
                    link
                    size="small"
                    :disabled="!row.previewable || !row.previewUrl"
                    :title="!row.previewable ? previewBlockedMsg(row.previewBlockedReason) : ''"
                    @click="openPreview(row)"
                  >预览</el-button>

                  <el-button
                    v-if="canReupload(row)"
                    link
                    size="small"
                    type="danger"
                    :loading="['requesting', 'running'].includes(reuploadState(row.fileKey).status)"
                    @click="openReupload(row)"
                  >{{ reuploadLabel(row.fileKey) }}</el-button>

                  <el-button
                    v-if="row.status === 'DB_ONLY'"
                    link
                    size="small"
                    type="warning"
                    @click="cleanupLocalRecord(row.fileKey)"
                  >清理本地</el-button>

                </div>

              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 文件网格 (grid 视图) -->
      <div v-else class="grid-section">
        <div class="files-grid">
          <div
            v-for="file in store.files"
            :key="file.fileKey"
            class="grid-card"
            :class="{ selected: store.selectedKeys.has(file.fileKey) }"
            @click="store.toggleSelect(file.fileKey, !store.selectedKeys.has(file.fileKey))"
          >
            <div class="grid-check">
              <el-icon v-if="store.selectedKeys.has(file.fileKey)" color="#409eff"><CircleCheckFilled /></el-icon>
              <el-icon v-else color="rgba(255,255,255,0.5)"><CircleCheck /></el-icon>
            </div>
            <div class="grid-status">
              <el-tag size="small" :type="statusTagType(file.status)" effect="dark">{{ statusLabel(file.status) }}</el-tag>
            </div>
            <el-image
              v-if="file.thumbnailUrl || file.previewUrl"
              :src="buildUrl(file.thumbnailUrl || file.previewUrl)"
              lazy
              fit="cover"
              class="grid-img"
              @click.stop="file.previewable && file.previewUrl ? openPreview(file) : undefined"
            >
              <template #error>
                <div class="grid-img-error"><el-icon size="32"><Picture /></el-icon></div>
              </template>
              <template #placeholder>
                <div class="grid-img-loading" />
              </template>
            </el-image>
            <div v-else class="grid-img-error"><el-icon size="32"><Picture /></el-icon></div>
            <div class="grid-name" :title="file.fileName">
              <span>{{ truncate(file.fileName, 30) }}</span>
              <small>{{ formatSize(file.size) }}</small>
              <small class="grid-local-check" :class="`grid-local-check--${file.localCheckStatus || 'not-checked'}`">{{ localCheckLabel(file) }}</small>
              <el-button
                v-if="canReupload(file)"
                link
                size="small"
                type="danger"
                :loading="['requesting', 'running'].includes(reuploadState(file.fileKey).status)"
                @click.stop="openReupload(file)"
              >{{ reuploadLabel(file.fileKey) }}</el-button>
            </div>
          </div>
        </div>
        <el-empty v-if="!store.files.length && !store.isLoading" description="暂无文件" />
      </div>

      <!-- 分页 -->
      <div class="pagination-row">
        <span v-if="store.keyword" class="search-info">搜索"{{ store.keyword }}"，共 {{ store.total }} 个</span>
        <el-pagination
          v-if="store.totalPages > 1"
          v-model:current-page="store.currentPage"
          :page-size="50"
          :total="store.total"
          layout="prev, pager, next, total"
          @current-change="p => store.loadFiles(p)"
        />
      </div>
    </div>

    <!-- 分配分组 Dialog -->
    <el-dialog v-model="assignVisible" title="分配分组" width="360px">
      <el-select v-model="assignGroupCode" placeholder="选择目标分组" style="width:100%">
        <el-option v-for="g in store.groups" :key="g.groupCode" :label="g.groupName" :value="g.groupCode" />
      </el-select>
      <p class="mt-8 text-muted small">已选 {{ store.selectedKeys.size }} 个文件</p>
      <template #footer>
        <el-button @click="assignVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!assignGroupCode" :loading="assignLoading" @click="doAssign">确认分配</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="reuploadVisible" title="确认重新上传" width="440px">
      <template v-if="reuploadFile">
        <div class="reupload-detail-list">
          <div><span>文件</span><strong>{{ reuploadFile.fileName }}</strong></div>
          <div><span>分组</span><strong>{{ reuploadFile.groupName || '未分组' }}</strong></div>
          <div><span>原始大小基线</span><strong>{{ reuploadFile.originalSize == null ? '未建立（将以当前文件建立）' : formatSize(reuploadFile.originalSize) }}</strong></div>
          <div><span>当前本地大小</span><strong>{{ formatSize(reuploadFile.localCheckObservedSize) }}</strong></div>
          <div><span>云端存储大小</span><strong>{{ formatSize(reuploadFile.size) }}</strong></div>
        </div>
        <el-alert
          :title="reuploadFile.localCheckStatus === 'BASELINE_MISSING'
            ? '无法确认本地文件是否与历史版本一致。确认后会覆盖同一云端对象，并以当前本地大小建立新的校验基线；系统内无法回滚。'
            : '确认后会以扫描目录中的本地文件覆盖同一云端对象，系统内无法回滚。'"
          type="warning"
          :closable="false"
          show-icon
        />
      </template>
      <template #footer>
        <el-button :disabled="reuploadLoading" @click="reuploadVisible = false">取消</el-button>
        <el-button type="danger" :loading="reuploadLoading" @click="doReupload">确认覆盖上传</el-button>
      </template>
    </el-dialog>

    <!-- 上传 -->
    <UploadModal v-model="uploadVisible" :category="store.category" @uploaded="store.loadFiles(store.currentPage)" />

    <!-- 预览 -->
    <PreviewModal v-model="previewVisible" :file="previewFile" @close="previewFile = null" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { useFilesStore } from '@/stores/files'
import UploadModal from '@/components/UploadModal.vue'
import PreviewModal from '@/components/PreviewModal.vue'
import HighlightedText from '@/components/HighlightedText.vue'
import { formatSize, formatDate } from '@/utils/format'
import type { FileItem, GroupFilter } from '@/types'

const route = useRoute()
const router = useRouter()
const store = useFilesStore()

const searchInput = ref('')
const groupFilter = ref<GroupFilter>('all')
const uploadVisible = ref(false)
const assignVisible = ref(false)
const assignLoading = ref(false)
const assignGroupCode = ref('')
const previewVisible = ref(false)
const previewFile = ref<FileItem | null>(null)
const syncLoading = ref(false)
const reuploadVisible = ref(false)
const reuploadLoading = ref(false)
const reuploadFile = ref<FileItem | null>(null)

const selectedDeletableKeys = computed(() => store.files
  .filter(file => file.deletable && file.status !== 'DB_ONLY' && store.selectedKeys.has(file.fileKey))
  .map(file => file.fileKey))

const syncStatusClass = computed(() => {
  if (syncLoading.value) return 'sync-compact--running'
  const meta = store.categoryMeta
  if (!meta?.lastSyncTime) return 'sync-compact--empty'
  if (meta.lastSyncStatus === 'FAILED') return 'sync-compact--failed'
  return 'sync-compact--success'
})

const syncCompactTitle = computed(() => {
  if (syncLoading.value) return '云端扫描：扫描中'
  const meta = store.categoryMeta
  if (!meta?.lastSyncTime) return '云端扫描：尚未扫描'
  if (meta.lastSyncStatus === 'FAILED') return '云端扫描失败'
  return `云端扫描：${formatDate(meta.lastSyncTime)}`
})

const syncCompactMeta = computed(() => {
  if (syncLoading.value) return '完成后自动刷新列表'
  const meta = store.categoryMeta
  if (!meta?.lastSyncTime) return '点击“扫描云端”同步云端文件状态'
  if (meta.lastSyncStatus === 'FAILED') return `${formatDate(meta.lastSyncTime)} · 查看详情`
  const diff = (meta.lastSyncOssOnly ?? 0) + (meta.lastSyncDbToOssMismatched ?? 0)
  return `匹配 ${meta.lastSyncOssToDbMatched ?? 0} · 差异 ${diff} · 异常 ${meta.lastSyncOssToDbMismatched ?? 0} · 已跳过 ${meta.lastSyncSkipped ?? 0}`
})

const syncChartRows = computed(() => {
  const meta = store.categoryMeta
  if (syncLoading.value || !meta?.lastSyncTime || meta.lastSyncStatus === 'FAILED') return []
  const rows = [
    { key: 'matched', label: '已匹配', value: meta.lastSyncOssToDbMatched ?? 0 },
    { key: 'oss-only', label: '仅云端', value: meta.lastSyncOssOnly ?? 0 },
    { key: 'db-only', label: '仅数据库', value: meta.lastSyncDbToOssMismatched ?? 0 },
    { key: 'abnormal', label: '状态异常', value: meta.lastSyncOssToDbMismatched ?? 0 },
    { key: 'skipped', label: '已跳过', value: meta.lastSyncSkipped ?? 0 },
  ]
  const total = rows.reduce((sum, row) => sum + row.value, 0)
  if (!total) return []
  return rows.map(row => ({
    ...row,
    percent: Math.round((row.value / total) * 100),
  }))
})

const syncChartSegments = computed(() => syncChartRows.value.filter(row => row.value > 0))

const syncDetailRows = computed(() => {
  const meta = store.categoryMeta
  if (syncLoading.value) {
    return [
      { label: '状态', value: '同步中' },
      { label: '说明', value: '同步完成后会自动刷新列表和统计摘要' },
    ]
  }
  if (!meta?.lastSyncTime) {
    return [
      { label: '状态', value: '尚未扫描' },
      { label: '说明', value: '点击“扫描云端”同步云端文件状态' },
    ]
  }
  const rows = [
    { label: '状态', value: meta.lastSyncStatus === 'FAILED' ? '失败' : '成功' },
    { label: '时间', value: formatDate(meta.lastSyncTime) },
  ]
  if (meta.lastSyncStatus === 'FAILED') {
    rows.push({ label: '错误', value: meta.lastSyncMessage || '请检查后端日志' })
    return rows
  }
  rows.push(
    { label: '云端对象', value: String(meta.lastSyncOssTotal ?? 0) },
  )
  if (syncChartRows.value.length) {
    rows.push({ label: '结果分布', value: '云端对象 + 本地差异' })
  }
  return rows
})

function buildUrl(raw: string | undefined) {
  if (!raw) return ''
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
  const base = import.meta.env.VITE_API_BASE ?? ''
  return base + (raw.startsWith('/') ? raw : '/' + raw)
}

function truncate(s: string | undefined, len: number) {
  if (!s) return ''
  if (s.length <= len) return s
  return s.slice(0, Math.floor(len * 0.6)) + '...' + s.slice(-Math.floor(len * 0.4))
}

function previewBlockedMsg(reason: string | undefined) {
  const map: Record<string, string> = {
    FROZEN: '文件未解冻，暂不可预览',
    TOO_LARGE: '文件过大，暂不支持预览',
    UNSUPPORTED_TYPE: '当前文件类型不支持预览',
    OSS_ONLY: '仅云端存在，无解密信息不可预览',
  }
  return reason ? map[reason] || '文件不可预览' : '文件不可预览'
}

function variantLabel(variant: string | undefined) {
  if (variant === 'image') return '图片视图'
  if (variant === 'archive') return '归档视图'
  return '文件视图'
}

function statusLabel(status: string | undefined) {
  const map: Record<string, string> = {
    UPLOADED: '已匹配',
    OSS_ONLY: '仅云端',
    DB_ONLY: '仅数据库',
    TO_BE_DELETED: '等待执行删除',
    UPLOADING: '上传中',
  }
  return status ? map[status] || status : '-'
}

function statusTagType(status: string | undefined) {
  if (status === 'UPLOADED') return 'success'
  if (status === 'OSS_ONLY') return 'primary'
  if (status === 'DB_ONLY') return 'warning'
  if (status === 'TO_BE_DELETED') return 'danger'
  if (status === 'UPLOADING') return 'primary'
  return 'info'
}

function localCheckLabel(file: FileItem) {
  if (file.status !== 'UPLOADED') return '不适用'
  const map: Record<string, string> = {
    SIZE_MATCHED: '大小一致',
    SIZE_CHANGED: '本地已改动',
    MISSING: '本地副本未发现',
    BASELINE_MISSING: '未建立大小基线',
    UNVERIFIABLE: '无法核对',
  }
  return file.localCheckStatus ? map[file.localCheckStatus] || file.localCheckStatus : '未检查'
}

function localCheckTagType(file: FileItem) {
  if (file.status !== 'UPLOADED') return 'info'
  if (file.localCheckStatus === 'SIZE_MATCHED') return 'success'
  if (file.localCheckStatus === 'SIZE_CHANGED') return 'danger'
  if (file.localCheckStatus === 'BASELINE_MISSING' || file.localCheckStatus === 'UNVERIFIABLE') return 'warning'
  return 'info'
}

function localCheckTip(file: FileItem) {
  if (file.status !== 'UPLOADED') return '仅已上传记录参与本地检查'
  if (file.localCheckStatus === 'SIZE_CHANGED') {
    return `当前本地 ${formatSize(file.localCheckObservedSize)}，原始大小基线 ${formatSize(file.originalSize)}`
  }
  if (file.localCheckStatus === 'MISSING') return '扫描目录中未发现匹配的本地副本'
  if (file.localCheckStatus === 'BASELINE_MISSING') return '历史记录没有原始大小基线；可确认重新上传并以当前本地大小建立新基线'
  if (file.localCheckStatus === 'UNVERIFIABLE') return '文件名、分组、数据库大小或本地路径无法安全核对'
  return '列表刷新时即时检查'
}

function dlState(fileKey: string) {
  return store.downloadStates.get(fileKey) || { status: 'idle' }
}

function dlLabel(fileKey: string) {
  const s = dlState(fileKey)
  if (s.status === 'preparing') return '准备中...'
  if (s.status === 'downloading') return `下载中 ${s.progress ?? ''}%`
  if (s.status === 'done') return '完成'
  if (s.status === 'failed') return '失败'
  return '下载'
}

function unfreezeState(fileKey: string) {
  return store.unfreezeStates.get(fileKey) || { status: 'idle' }
}

function unfreezeLabel(fileKey: string) {
  const s = unfreezeState(fileKey)
  if (s.status === 'done') return '已解冻'
  if (s.status !== 'idle') return '解冻中...'
  return '解冻'
}

function reuploadState(fileKey: string) {
  return store.reuploadStates.get(fileKey) || { status: 'idle' }
}

function canReupload(file: FileItem) {
  return file.localCheckStatus === 'SIZE_CHANGED' || file.localCheckStatus === 'BASELINE_MISSING'
}

function reuploadLabel(fileKey: string) {
  const state = reuploadState(fileKey)
  if (state.status === 'requesting') return '准备覆盖上传...'
  if (state.status === 'running') return '覆盖上传中...'
  if (state.status === 'done') return '已完成'
  if (state.status === 'unknown') return '结果未知'
  if (state.status === 'failed') return '上传失败'
  return '重新上传'
}

function doSearch() {
  store.setKeyword(searchInput.value)
}

function onGroupChange(val: GroupFilter) {
  store.setGroupFilter(val)
}

function goCreateGroup() {
  router.push({ path: '/admin/categories', query: { category: store.category, action: 'new-group' } })
}

function onSelectionChange(rows: FileItem[]) {
  store.selectedKeys.clear()
  rows.forEach(r => store.selectedKeys.add(r.fileKey))
}

function openPreview(file: FileItem) {
  previewFile.value = file
  previewVisible.value = true
}

function openReupload(file: FileItem) {
  reuploadFile.value = file
  reuploadVisible.value = true
}

async function doReupload() {
  if (!reuploadFile.value) return
  reuploadLoading.value = true
  try {
    await store.reuploadLocal(reuploadFile.value)
    reuploadVisible.value = false
  } finally {
    reuploadLoading.value = false
  }
}

function openAssign() {
  if (!store.selectedKeys.size) { ElMessage.warning('请先选择文件'); return }
  assignGroupCode.value = ''
  assignVisible.value = true
}

async function doAssign() {
  if (!assignGroupCode.value) return
  assignLoading.value = true
  try {
    await store.assignToGroup(assignGroupCode.value)
    assignVisible.value = false
  } finally {
    assignLoading.value = false
  }
}

async function confirmDelete(fileKeys: string[]) {
  await ElMessageBox.confirm(
    `已选择 ${store.selectedKeys.size} 个文件，其中 ${fileKeys.length} 个允许删除。确认将这 ${fileKeys.length} 个文件标记为待删除？`,
    '标记删除',
    { type: 'warning' }
  )
  await store.deleteFiles(fileKeys)
}

async function deleteSelected() {
  if (!selectedDeletableKeys.value.length) {
    ElMessage.warning('所选文件中没有可删除项')
    return
  }
  await confirmDelete(selectedDeletableKeys.value)
}

async function confirmDeleteAll() {
  const pendingCount = store.files.filter(file => file.status === 'TO_BE_DELETED').length
  if (!pendingCount) {
    ElMessage.warning('当前列表没有等待执行删除的文件')
    return
  }
  await ElMessageBox.confirm(`确认删除当前列表中 ${pendingCount} 个“等待执行删除”的文件？此操作不可撤销。`, '确认', { type: 'warning' })
  await store.confirmDeleteAll()
}

async function confirmRelease(fileKey: string) {
  await ElMessageBox.confirm('确定要释放本地文件吗？此操作会删除本地副本，但不会影响云端文件。', '确认', { type: 'warning' })
  await store.releaseLocal(fileKey)
}

async function cleanupLocalRecord(fileKey: string) {
  await ElMessageBox.confirm('仅清理本地记录，不会删除云端对象。请确认云端中确实不存在该文件。', '清理本地记录', { type: 'warning' })
  await store.cleanupLocal([fileKey])
}

async function doSync() {
  syncLoading.value = true
  try {
    await store.syncRemote()
  } finally {
    syncLoading.value = false
  }
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}

onMounted(async () => {
  const cat = decodeURIComponent(String(route.params.category))
  await store.init(cat)
  searchInput.value = store.keyword
  groupFilter.value = store.groupFilter
})

watch(() => route.params.category, async (newCat) => {
  if (newCat) {
    const cat = decodeURIComponent(String(newCat))
    await store.init(cat)
    searchInput.value = store.keyword
    groupFilter.value = store.groupFilter
  }
})

onUnmounted(() => {
  store.cleanupTasks()
})
</script>

<style scoped>
.files-hero { margin-bottom: 16px; }
.back-button { padding-left: 0; margin-bottom: 8px; color: var(--hive-muted); }
.hero-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  min-width: min(360px, 100%);
}
.hero-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
.sync-compact {
  display: flex;
  align-items: center;
  gap: 10px;
  width: min(360px, 100%);
  padding: 10px 12px;
  border: 1px solid var(--hive-border-soft);
  border-radius: 14px;
  background: var(--hive-surface);
  box-shadow: var(--hive-shadow-soft);
  backdrop-filter: blur(10px);
}
.sync-dot {
  width: 10px;
  height: 10px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--hive-subtle);
  box-shadow: 0 0 0 4px rgba(152, 162, 179, 0.14);
}
.sync-copy { min-width: 0; flex: 1 1 auto; }
.sync-compact-title { font-size: 0.86rem; font-weight: 800; color: var(--hive-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sync-compact-meta { margin-top: 2px; font-size: 0.78rem; color: var(--hive-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sync-bars,
.sync-detail-bars {
  display: flex;
  width: 100%;
  height: 6px;
  margin-top: 7px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--hive-border-soft);
}
.sync-detail-bars { margin: 4px 0 2px; height: 8px; }
.sync-bar-segment { min-width: 3px; height: 100%; }
.sync-bar-segment--matched { background: var(--hive-success); }
.sync-bar-segment--oss-only { background: var(--hive-primary); }
.sync-bar-segment--db-only { background: var(--hive-warning); }
.sync-bar-segment--abnormal { background: var(--hive-danger); }
.sync-bar-segment--skipped { background: var(--hive-subtle); }
.sync-compact--success .sync-dot { background: var(--hive-success); box-shadow: 0 0 0 4px rgba(22, 163, 74, 0.14); }
.sync-compact--failed .sync-dot { background: var(--hive-danger); box-shadow: 0 0 0 4px rgba(220, 38, 38, 0.14); }
.sync-compact--running .sync-dot { background: var(--hive-primary); box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.16); animation: pulse-dot 1.2s infinite ease-in-out; }
.sync-compact--empty .sync-dot { background: var(--hive-subtle); }
.sync-detail-list { display: grid; gap: 9px; }
.sync-detail-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; font-size: 0.86rem; }
.sync-detail-row span { color: var(--hive-muted); }
.sync-detail-row--metric span { display: inline-flex; align-items: center; gap: 7px; }
.sync-detail-row strong { color: var(--hive-text); text-align: right; word-break: break-word; }
.sync-detail-row strong small { margin-left: 6px; color: var(--hive-muted); font-size: 0.76rem; font-weight: 700; }
.sync-metric-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--hive-subtle); }
.sync-metric-dot--matched { background: var(--hive-success); }
.sync-metric-dot--oss-only { background: var(--hive-primary); }
.sync-metric-dot--db-only { background: var(--hive-warning); }
.sync-metric-dot--abnormal { background: var(--hive-danger); }
.sync-metric-dot--skipped { background: var(--hive-subtle); }
@keyframes pulse-dot {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(0.72); opacity: 0.72; }
}
.toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 14px;
  background: var(--hive-surface);
  border: 1px solid var(--hive-border-soft);
  border-radius: var(--hive-radius-lg);
  padding: 14px;
  margin-bottom: 14px;
  box-shadow: var(--hive-shadow-soft);
}
.toolbar-filter {
  display: flex;
  gap: 10px;
  flex: 1 1 auto;
  min-width: 280px;
}
.search-input { width: min(340px, 100%); }
.group-select { width: 180px; }
.new-group-button { flex: 0 0 auto; }
.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  flex: 0 0 auto;
}
.list-section {
  background: var(--hive-surface-solid);
  border: 1px solid var(--hive-border-soft);
  border-radius: var(--hive-radius-lg);
  overflow: hidden;
  box-shadow: var(--hive-shadow-soft);
}
.expand-panel {
  display: grid;
  gap: 12px;
  padding: 12px 24px;
}
.expand-item label {
  font-size: 0.75rem;
  color: var(--hive-muted);
  text-transform: uppercase;
  display: block;
  margin-bottom: 4px;
}
.expand-value {
  background: #f8fafc;
  padding: 8px;
  border-radius: 10px;
  font-size: 0.875rem;
  word-break: break-all;
  white-space: pre-wrap;
  margin-bottom: 6px;
}
.truncated-name { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.action-cell { display: flex; flex-direction: column; gap: 4px; }
.action-row { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.grid-section {
  background: var(--hive-surface-solid);
  border: 1px solid var(--hive-border-soft);
  border-radius: var(--hive-radius-lg);
  padding: 16px;
  box-shadow: var(--hive-shadow-soft);
}
.files-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 16px;
}
.grid-card {
  border-radius: 16px;
  border: 2px solid transparent;
  overflow: hidden;
  cursor: pointer;
  position: relative;
  background: #f8fafc;
  transition: transform 0.16s, border-color 0.16s, box-shadow 0.16s;
}
.grid-card.selected { border-color: var(--hive-primary); box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.10); }
.grid-card:hover { transform: translateY(-3px); border-color: #bfdbfe; box-shadow: 0 16px 30px rgba(15, 23, 42, 0.10); }
.grid-check {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 2;
}
.grid-status { position: absolute; top: 6px; right: 6px; z-index: 2; }
.grid-img {
  width: 100%;
  aspect-ratio: 1;
  display: block;
}
.grid-img-error, .grid-img-loading {
  width: 100%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f1f5f9, #e2e8f0);
  color: var(--hive-subtle);
}
.grid-img-loading {
  background: linear-gradient(90deg, #e8e8e8 25%, #f0f0f0 50%, #e8e8e8 75%);
  background-size: 400px 100%;
  animation: shimmer 1.4s infinite linear;
}
@keyframes shimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
.grid-name {
  padding: 10px 12px;
  font-size: 0.82rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.grid-name small {
  color: var(--hive-muted);
}
.grid-local-check--SIZE_MATCHED { color: var(--hive-success) !important; }
.grid-local-check--SIZE_CHANGED { color: var(--hive-danger) !important; }
.grid-local-check--BASELINE_MISSING { color: var(--hive-warning) !important; }
.grid-local-check--UNVERIFIABLE { color: var(--hive-warning) !important; }
.reupload-detail-list { display: grid; gap: 10px; margin-bottom: 16px; }
.reupload-detail-list div { display: flex; justify-content: space-between; gap: 16px; font-size: 0.86rem; }
.reupload-detail-list span { color: var(--hive-muted); }
.reupload-detail-list strong { text-align: right; word-break: break-word; }
.pagination-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  padding: 16px 0;
  flex-wrap: wrap;
}
.search-info { color: var(--hive-muted); font-size: 0.875rem; }
.mt-8 { margin-top: 8px; }
.text-muted { color: var(--hive-muted); }
.small { font-size: 0.875rem; }
@media (max-width: 760px) {
  .toolbar-filter, .toolbar-actions, .hero-actions, .hero-side, .sync-compact { width: 100%; }
  .hero-side { align-items: stretch; }
  .toolbar-filter { flex-direction: column; }
  .search-input, .group-select, .new-group-button { width: 100%; }
}
</style>
