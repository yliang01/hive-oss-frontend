<template>
  <div class="home-page ops-page">
    <div class="home-container ops-container">
      <header class="ops-hero">
        <div>
          <div class="ops-kicker">Hive Cloud Ops</div>
          <h1 class="ops-title">OSS 管理控制台</h1>
        </div>
      </header>

      <div class="metric-grid">
        <div class="metric-card">
          <span class="metric-label">文件分类</span>
          <strong>{{ categories.length }}</strong>
          <span class="metric-hint">当前启用 {{ enabledCategoryCount }} 个</span>
        </div>
        <div class="metric-card metric-card--cyan">
          <span class="metric-label">备份批次</span>
          <strong>{{ store.backupList.length }}</strong>
          <span class="metric-hint">按创建时间倒序展示</span>
        </div>
        <div class="metric-card metric-card--status">
          <span class="metric-label">最近任务</span>
          <strong>{{ latestBackupStatus }}</strong>
          <span class="metric-hint">{{ latestBackupTime }}</span>
        </div>
      </div>

      <el-row :gutter="24">
        <el-col :xs="24" :lg="12">
          <el-card class="home-card" shadow="never">
            <template #header>
              <div class="card-title-row">
                <div class="ops-card-title">
                  <span class="ops-icon-box"><el-icon><Coin /></el-icon></span>
                  <span>数据库备份与恢复</span>
                </div>
              </div>
            </template>

            <div class="action-row">
              <el-button type="primary" size="large" :loading="store.isBackupRunning" :disabled="store.actionsDisabled" @click="store.startBackup()">
                <el-icon><Upload /></el-icon>开始备份
              </el-button>
              <el-button size="large" :loading="store.isLoading" @click="store.loadBackupList()">
                <el-icon><Refresh /></el-icon>刷新列表
              </el-button>
            </div>

            <div v-if="store.taskStatus" class="task-panel" :class="`task-panel--${store.taskStatus.state}`">
              <div class="task-panel-header">
                <el-tag :type="stateTagType">
                  <el-icon v-if="store.taskStatus.state === 'running'" class="is-loading"><Loading /></el-icon>
                  {{ stateLabel }}
                </el-tag>
                <span class="task-updated">{{ taskUpdatedAt }}</span>
              </div>
              <el-descriptions :column="1" size="small" class="task-desc">
                <el-descriptions-item label="任务">{{ store.taskStatus.taskType === 'BACKUP' ? '数据库备份' : '数据库恢复' }}</el-descriptions-item>
                <el-descriptions-item label="批次">
                  <span class="mono">{{ store.taskStatus.batchId }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="阶段">{{ store.taskStatus.phase }}</el-descriptions-item>
                <el-descriptions-item v-if="store.taskStatus.detail" label="详情">{{ store.taskStatus.detail }}</el-descriptions-item>
                <el-descriptions-item label="进度">
                  轮询 {{ store.taskStatus.pollAttempts }} 次 · 已耗时 {{ store.taskStatus.elapsedSeconds }} 秒
                </el-descriptions-item>
              </el-descriptions>
            </div>

            <div class="section-title">
              <span>备份历史</span>
              <span class="section-caption">{{ store.backupList.length }} 批次</span>
            </div>
            <el-empty v-if="!store.backupList.length && !store.isLoading" description="暂无备份" :image-size="60" />
            <el-skeleton v-if="store.isLoading" :rows="3" animated />
            <div v-for="(item, idx) in store.backupList" :key="item.batchId" class="backup-item">
              <div class="backup-item-info">
                <div class="backup-title-row">
                  <span class="mono fw-bold">{{ item.batchId }}</span>
                  <el-tag size="small" :type="backupTagType(item.status)">{{ item.status }}</el-tag>
                </div>
                <div class="backup-meta">
                  <span v-if="item.database">{{ item.database }}</span>
                  <span>{{ fmtDate(item.createdAt) }}</span>
                </div>
              </div>
              <div class="backup-item-actions">
                <el-button
                  size="small"
                  :disabled="item.status !== 'UPLOADED' || store.actionsDisabled"
                  @click="confirmRestore(item.batchId)"
                >恢复</el-button>
                <el-button
                  size="small"
                  type="danger"
                  plain
                  :disabled="idx === 0 || store.actionsDisabled"
                  :title="idx === 0 ? '最新备份不可删除' : ''"
                  @click="confirmDeleteBackup(item.batchId, item.createdAt)"
                >删除</el-button>
              </div>
            </div>
          </el-card>
        </el-col>

        <el-col :xs="24" :lg="12">
          <el-card class="home-card" shadow="never">
            <template #header>
              <div class="card-title-row">
                <div class="ops-card-title">
                  <span class="ops-icon-box"><el-icon><Grid /></el-icon></span>
                  <span>文件分类</span>
                </div>
                <div>
                  <el-button size="small" @click="router.push('/admin/categories')">
                    <el-icon><Setting /></el-icon>分类管理
                  </el-button>
                  <el-button size="small" :loading="catLoading" @click="loadCategories">
                    <el-icon><Refresh /></el-icon>刷新
                  </el-button>
                </div>
              </div>
            </template>

            <el-empty v-if="!categories.length && !catLoading" description="暂无分类" :image-size="60" />
            <el-skeleton v-if="catLoading" :rows="4" animated />
            <div class="category-grid">
              <div
                v-for="cat in categories"
                :key="cat.code"
                class="category-item"
                @click="router.push(`/files/${encodeURIComponent(cat.code)}`)"
              >
                <div class="category-icon" :class="`category-icon--${cat.uiVariant}`">
                  <el-icon v-if="cat.uiVariant === 'image'"><Picture /></el-icon>
                  <el-icon v-else-if="cat.uiVariant === 'archive'"><Box /></el-icon>
                  <el-icon v-else><Document /></el-icon>
                </div>
                <div class="category-main">
                  <div class="cat-name">{{ cat.name || cat.code }}</div>
                  <div class="cat-meta">
                    <span>{{ cat.code }}</span>
                    <span>{{ cat.storageClass }}</span>
                  </div>
                </div>
                <el-tag size="small" :type="cat.enabled ? 'success' : 'info'">{{ cat.enabled ? '启用' : '停用' }}</el-tag>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { useBackupStore } from '@/stores/backup'
import { getCategories } from '@/api/categories'
import { formatDate } from '@/utils/format'
import type { Category } from '@/types'

const router = useRouter()
const store = useBackupStore()

const categories = ref<Category[]>([])
const catLoading = ref(false)

const taskUpdatedAt = ref('')
let taskTimer: number | undefined

const enabledCategoryCount = computed(() => categories.value.filter(c => c.enabled).length)
const latestBackupStatus = computed(() => store.backupList[0]?.status || '暂无')
const latestBackupTime = computed(() => store.backupList[0]?.createdAt ? formatDate(store.backupList[0].createdAt) : '等待首次备份')

const stateTagType = computed(() => {
  switch (store.taskStatus?.state) {
    case 'success': return 'success'
    case 'failed': return 'danger'
    case 'restart-needed': return 'warning'
    default: return 'primary'
  }
})

const stateLabel = computed(() => {
  switch (store.taskStatus?.state) {
    case 'success': return '已完成'
    case 'failed': return '失败'
    case 'restart-needed': return '需要重启'
    default: return '进行中'
  }
})

function fmtDate(iso: string) {
  return formatDate(iso)
}

function backupTagType(status: string) {
  if (status === 'UPLOADED' || status === 'RESTORED') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'PENDING') return 'warning'
  return 'info'
}

async function loadCategories() {
  catLoading.value = true
  try {
    const res = await getCategories()
    categories.value = res.data || []
  } catch {}
  catLoading.value = false
}

async function confirmRestore(batchId: string) {
  await ElMessageBox.confirm(`确认恢复备份 ${batchId}？此操作将覆盖当前数据库。`, '确认恢复', { type: 'warning', confirmButtonText: '恢复', cancelButtonText: '取消' })
  store.startRestore(batchId)
}

async function confirmDeleteBackup(batchId: string, createdAt: string) {
  await ElMessageBox.confirm(
    `确认删除备份 ${batchId}（${formatDate(createdAt)}）？将移除 archive / checksum / manifest 三个文件。`,
    '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
  )
  store.deleteBackup(batchId)
}

onMounted(() => {
  loadCategories()
  store.loadBackupList()
  taskTimer = window.setInterval(() => {
    if (store.taskStatus) taskUpdatedAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  }, 2000)
})

onUnmounted(() => {
  if (taskTimer !== undefined) window.clearInterval(taskTimer)
})
</script>

<style scoped>
.home-card {
  height: 100%;
  margin-bottom: 24px;
}
.hero-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
.metric-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-bottom: 22px; }
.metric-card { position: relative; overflow: hidden; padding: 18px 20px; border: 1px solid var(--hive-border-soft); border-radius: var(--hive-radius-lg); background: linear-gradient(135deg, #fff, #eff6ff); box-shadow: var(--hive-shadow-soft); }
.metric-card::after { content: ''; position: absolute; right: -34px; top: -34px; width: 110px; height: 110px; border-radius: 999px; background: rgba(37, 99, 235, 0.10); }
.metric-card--cyan { background: linear-gradient(135deg, #fff, #ecfeff); }
.metric-card--cyan::after { background: rgba(8, 145, 178, 0.12); }
.metric-card--status { background: linear-gradient(135deg, #fff, #f8fafc); }
.metric-label { display: block; color: var(--hive-muted); font-size: 0.82rem; font-weight: 800; }
.metric-card strong { display: block; margin-top: 8px; font-size: 2rem; line-height: 1; letter-spacing: -0.04em; }
.metric-hint { display: block; margin-top: 8px; color: var(--hive-subtle); font-size: 0.8rem; }
.card-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.card-desc {
  color: var(--hive-muted);
  font-size: 0.875rem;
  margin-bottom: 16px;
  line-height: 1.7;
}
.action-row {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.task-panel {
  border-radius: 14px;
  padding: 14px 16px;
  margin-bottom: 16px;
  border: 1px solid var(--hive-border);
}
.task-panel--running { background: #eff6ff; border-color: #bfdbfe; }
.task-panel--success { background: #f0fdf4; border-color: #bbf7d0; }
.task-panel--failed, .task-panel--restart-needed { background: #fff7ed; border-color: #fed7aa; }
.task-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.task-updated { font-size: 0.75rem; color: var(--hive-muted); }
.task-desc { margin-top: 4px; }
.section-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  font-size: 0.875rem;
  margin: 16px 0 8px;
  color: var(--hive-text);
}
.section-caption { color: var(--hive-subtle); font-weight: 500; }
.backup-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--hive-border-soft);
}
.backup-item:last-child { border-bottom: none; }
.backup-item-info { flex: 1; min-width: 0; }
.backup-title-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
.backup-meta { display: flex; gap: 12px; margin-top: 5px; color: var(--hive-muted); font-size: 0.82rem; flex-wrap: wrap; }
.backup-item-actions { display: flex; gap: 8px; flex-shrink: 0; }
.ms-2 { margin-left: 8px; }
.fw-bold { font-weight: 600; }
.text-muted { color: var(--hive-muted); }
.small { font-size: 0.875rem; }
.category-grid { display: grid; gap: 10px; }
.category-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--hive-border-soft);
  cursor: pointer;
  border-radius: 14px;
  background: #fff;
  transition: transform 0.16s, border-color 0.16s, box-shadow 0.16s;
}
.category-item:hover { transform: translateY(-2px); border-color: #bfdbfe; box-shadow: 0 12px 26px rgba(37, 99, 235, 0.10); }
.category-icon { width: 42px; height: 42px; display: inline-flex; align-items: center; justify-content: center; border-radius: 14px; background: var(--hive-primary-soft); color: var(--hive-primary); font-size: 1.2rem; flex-shrink: 0; }
.category-icon--image { background: #ecfdf5; color: var(--hive-success); }
.category-icon--archive { background: #fff7ed; color: var(--hive-warning); }
.category-main { flex: 1; min-width: 0; }
.cat-name { font-weight: 500; }
.cat-meta { display: flex; gap: 10px; margin-top: 4px; color: var(--hive-muted); font-size: 0.78rem; }
@media (max-width: 900px) { .metric-grid { grid-template-columns: 1fr; } .hero-actions { justify-content: flex-start; } }
@media (max-width: 560px) { .backup-item { align-items: flex-start; flex-direction: column; } .backup-item-actions { width: 100%; } }
</style>
