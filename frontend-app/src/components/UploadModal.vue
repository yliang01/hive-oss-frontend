<template>
  <el-dialog v-model="visible" title="上传文件" width="520px" :before-close="beforeClose" @close="resetState">
    <div
      class="upload-area"
      :class="{ dragover: isDragging }"
      @click="fileInput?.click()"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="onDrop"
    >
      <el-icon class="upload-icon"><Upload /></el-icon>
      <p class="upload-text">点击或拖拽文件到此处</p>
      <p class="upload-hint">{{ selectedFiles.length ? `已选 ${selectedFiles.length} 个文件` : '支持大文件流式上传' }}</p>
      <input ref="fileInput" type="file" multiple style="display:none" @change="onFileChange" />
    </div>

    <ul v-if="uploadItems.length" class="file-list">
      <li v-for="item in uploadItems" :key="item.name" class="file-item">
        <span class="file-name" :title="item.name">{{ item.name }}</span>
        <span class="file-size">{{ fmtSize(item.size) }}</span>
        <el-tag :type="statusType(item.status)" size="small">{{ statusLabel(item.status) }}</el-tag>
        <el-progress v-if="item.status === 'uploading'" :percentage="item.progress" :stroke-width="4" style="width:80px" />
      </li>
    </ul>

    <template #footer>
      <el-button :disabled="uploading" @click="visible = false">关闭</el-button>
      <el-button type="primary" :disabled="!selectedFiles.length || uploading" :loading="uploading" @click="startUpload">
        开始上传
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { checkUpload, uploadFile } from '@/api/files'
import { formatSize } from '@/utils/format'

const props = defineProps<{ modelValue: boolean; category: string }>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'uploaded'): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})

type ItemStatus = 'pending' | 'uploading' | 'done' | 'exists' | 'conflict' | 'failed'
interface UploadItem { name: string; size: number; file: File; status: ItemStatus; progress: number }

const fileInput = ref<HTMLInputElement>()
const selectedFiles = ref<File[]>([])
const uploadItems = ref<UploadItem[]>([])
const uploading = ref(false)
const isDragging = ref(false)

function fmtSize(n: number) { return formatSize(n) }

function onFileChange() {
  const files = Array.from(fileInput.value?.files || [])
  applyFiles(files)
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  const files = Array.from(e.dataTransfer?.files || [])
  applyFiles(files)
}

function applyFiles(files: File[]) {
  selectedFiles.value = files
  uploadItems.value = files.map(f => ({ name: f.name, size: f.size, file: f, status: 'pending', progress: 0 }))
}

function resetState() {
  if (uploading.value) return
  selectedFiles.value = []
  uploadItems.value = []
  uploading.value = false
  if (fileInput.value) fileInput.value.value = ''
}

function beforeClose(done: () => void) {
  if (!uploading.value) {
    done()
    return
  }
  ElMessageBox.alert('文件正在上传中，请等待当前上传完成后再关闭窗口。', '上传进行中', {
    type: 'warning',
    confirmButtonText: '知道了',
  })
}

function setStatus(idx: number, status: ItemStatus, progress = 0) {
  if (uploadItems.value[idx]) {
    uploadItems.value[idx].status = status
    uploadItems.value[idx].progress = progress
  }
}

function statusLabel(s: ItemStatus) {
  return { pending: '待上传', uploading: '上传中', done: '完成', exists: '已存在', conflict: '冲突', failed: '失败' }[s]
}

function statusType(s: ItemStatus): '' | 'success' | 'info' | 'warning' | 'danger' {
  return { pending: 'info', uploading: '', done: 'success', exists: 'warning', conflict: 'warning', failed: 'danger' }[s] as any
}

async function startUpload() {
  if (!props.category || !selectedFiles.value.length) return
  uploading.value = true
  let anyUploaded = false

  for (let i = 0; i < selectedFiles.value.length; i++) {
    const file = selectedFiles.value[i]
    setStatus(i, 'uploading')
    try {
      const checkRes = await checkUpload(props.category, file.name)
      if (checkRes.status === 409) { setStatus(i, 'conflict'); continue }
      if (!checkRes.data || checkRes.status >= 400) { setStatus(i, 'failed'); continue }
      if (checkRes.data.exists) { setStatus(i, 'exists'); anyUploaded = true; continue }

      await uploadFile(props.category, file, pct => setStatus(i, 'uploading', pct))
      setStatus(i, 'done', 100)
      anyUploaded = true
    } catch (e: any) {
      setStatus(i, 'failed')
      ElMessage.error(`${file.name} 上传失败：${e.response?.data?.error ?? e.message ?? '未知错误'}`)
    }
  }

  uploading.value = false
  if (anyUploaded) emit('uploaded')
}
</script>

<style scoped>
.upload-area {
  border: 2px dashed #bfdbfe;
  border-radius: 18px;
  padding: 42px 24px;
  text-align: center;
  cursor: pointer;
  background: linear-gradient(135deg, #f8fbff, #eef6ff);
  transition: border-color 0.2s, background 0.2s, transform 0.2s;
}
.upload-area:hover, .upload-area.dragover {
  border-color: #409eff;
  background: linear-gradient(135deg, #eff6ff, #ffffff);
  transform: translateY(-2px);
}
.upload-icon { font-size: 3rem; color: var(--hive-primary); margin-bottom: 8px; }
.upload-text { font-size: 1.05rem; font-weight: 800; color: var(--hive-text); margin: 0 0 4px; }
.upload-hint { font-size: 0.875rem; color: var(--hive-muted); margin: 0; }
.file-list { list-style: none; padding: 0; margin: 16px 0 0; max-height: 240px; overflow-y: auto; }
.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--hive-border-soft);
  border-radius: 12px;
  margin-bottom: 8px;
  background: #fff;
  font-size: 0.875rem;
}
.file-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-size { color: var(--hive-muted); white-space: nowrap; }
</style>
