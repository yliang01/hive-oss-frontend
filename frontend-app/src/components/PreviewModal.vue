<template>
  <el-dialog
    v-model="visible"
    :title="`文件预览 - ${file?.fileName || ''}`"
    width="90vw"
    style="max-width: 1280px"
    top="4vh"
    destroy-on-close
    @close="emit('close')"
  >
    <div class="preview-body">
      <template v-if="file">
        <img v-if="isImage" :src="previewUrl" class="preview-image" :alt="file.fileName" />
        <iframe v-else-if="isDoc" :src="previewUrl" class="preview-frame" :title="file.fileName" />
        <el-empty v-else description="当前文件类型暂不支持弹窗预览，请下载后查看" />
      </template>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FileItem } from '@/types'
import { inferMimeType } from '@/utils/format'

const props = defineProps<{ modelValue: boolean; file: FileItem | null; baseUrl?: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void; (e: 'close'): void }>()

const visible = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})

function buildUrl(raw: string | undefined) {
  if (!raw) return ''
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
  return (props.baseUrl ?? '') + (raw.startsWith('/') ? raw : '/' + raw)
}

const previewUrl = computed(() => buildUrl(props.file?.previewUrl))
const mime = computed(() => props.file ? inferMimeType(props.file) : '')
const isImage = computed(() => mime.value.startsWith('image/'))
const isDoc = computed(() => mime.value === 'application/pdf' || mime.value.startsWith('text/'))
</script>

<style scoped>
.preview-body {
  min-height: 50vh;
  max-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  border-radius: 16px;
  background:
    linear-gradient(45deg, #f8fafc 25%, transparent 25%),
    linear-gradient(-45deg, #f8fafc 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #f8fafc 75%),
    linear-gradient(-45deg, transparent 75%, #f8fafc 75%);
  background-position: 0 0, 0 12px, 12px -12px, -12px 0;
  background-size: 24px 24px;
  background-color: #fff;
}
.preview-image {
  max-width: 100%;
  max-height: 76vh;
  object-fit: contain;
  border-radius: 12px;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.16);
}
.preview-frame {
  width: 100%;
  height: 76vh;
  background: #fff;
  border: 1px solid var(--hive-border);
  border-radius: 12px;
}
</style>
