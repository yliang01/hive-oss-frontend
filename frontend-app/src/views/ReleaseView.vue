<template>
  <main class="ops-page release-page">
    <div class="ops-container release-container">
      <header class="ops-hero release-hero">
        <div>
          <div class="ops-kicker">Hive · RELEASE</div>
          <h1 class="ops-title">发布程序</h1>
          <p class="ops-subtitle">发布程序目录与加密配置包到 OSS，再签发下载 ticket 给目标机器使用。</p>
        </div>
        <el-button @click="$router.push('/setup')">配置与启动</el-button>
      </header>

      <section class="release-status" :class="`state-${status?.state ?? 'idle'}`">
        <div class="status-indicator" :class="{ 'is-active': status?.state === 'publishing', 'is-ready': status?.state === 'complete' }"></div>
        <div class="status-copy">
          <strong>{{ labels[status?.state ?? 'idle'] ?? status?.state ?? '读取状态' }}</strong>
          <span>{{ latestMessage || '准备好后可以发布新版本。' }}</span>
        </div>
        <div class="build-info">
          <span>当前程序</span>
          <code>{{ runningBuild || '读取中…' }}</code>
        </div>
      </section>

      <el-alert v-if="error" class="release-error" :title="error" type="error" :closable="false" />

      <el-card class="release-card" shadow="never">
        <div class="section-heading">
          <div class="step-number">01</div>
          <div>
            <h2>发布新版本</h2>
            <p>发布 `.release/build` 中的程序文件，并使用当前已加载的秘密 YAML 生成加密配置包。</p>
          </div>
        </div>

        <el-form label-position="top" class="release-form">
          <div class="release-fields">
            <el-form-item label="版本号">
              <el-input v-model="version" placeholder="例如 1.0.1" :disabled="busy" />
            </el-form-item>
            <el-form-item label="配置包密码" class="field-wide">
              <el-input v-model="password" type="password" show-password autocomplete="new-password" :disabled="busy" placeholder="生成新包至少 12 字符" />
              <div class="field-hint">目标机器需要使用这个密码解锁配置包。</div>
            </el-form-item>
          </div>
          <el-button type="primary" :disabled="busy || !version || !password" :loading="submitting" @click="publish">
            发布到 OSS
          </el-button>
        </el-form>

        <el-descriptions v-if="status?.id" class="release-result" :column="1" border>
          <el-descriptions-item label="版本">{{ status.version }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ labels[status.state] ?? status.state }}</el-descriptions-item>
          <el-descriptions-item v-if="status.archiveSha256" label="程序 SHA-256"><span class="release-hash">{{ status.archiveSha256 }}</span></el-descriptions-item>
          <el-descriptions-item v-if="status.configSha256" label="配置 SHA-256"><span class="release-hash">{{ status.configSha256 }}</span></el-descriptions-item>
        </el-descriptions>
        <ol v-if="status?.messages?.length" aria-live="polite" class="release-log">
          <li v-for="(message, index) in status.messages" :key="index">{{ message }}</li>
        </ol>
      </el-card>

      <el-card class="ticket-card" shadow="never">
        <div class="section-heading">
          <div class="step-number step-secondary">02</div>
          <div>
            <h2>签发下载 ticket</h2>
            <p>目标机器使用 ticket 从 OSS 下载指定版本的加密配置包。</p>
          </div>
        </div>
        <el-form label-position="top" class="ticket-form">
          <el-form-item label="下载版本">
            <el-input v-model="ticketVersion" placeholder="输入已发布的版本号" :disabled="busy" />
          </el-form-item>
          <el-form-item label="有效时间（秒）">
            <el-input-number v-model="ticketSeconds" :min="1" :disabled="busy" />
          </el-form-item>
          <div class="ticket-action">
            <el-button :disabled="busy || !ticketVersion || !ticketSeconds" :loading="issuingTicket" @click="downloadTicket">
              下载 ticket 文件
            </el-button>
          </div>
        </el-form>
      </el-card>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import { getRelease, publishRelease, createTicket, type ReleaseStatus } from '@/api/release'
import { getSetup } from '@/api/setup'

const status = ref<ReleaseStatus>(), version = ref(''), password = ref(''), error = ref(''), submitting = ref(false), issuingTicket = ref(false)
const runningBuild = ref('')
const ticketVersion = ref(''), ticketSeconds = ref<number>()
const labels: Record<string, string> = { idle: '等待发布', publishing: '正在发布', complete: '发布完成', failed: '发布失败' }
const busy = computed(() => submitting.value || issuingTicket.value || status.value?.state === 'publishing')
const latestMessage = computed(() => {
  const messages = status.value?.messages ?? []
  return messages.length ? messages[messages.length - 1] : ''
})
let timer: ReturnType<typeof setTimeout>, alive = true

function failure(e: any) { error.value = e?.response?.data?.message ?? '操作失败，请检查本机配置后重试。' }

async function refresh() {
  try { const next = await getRelease(); if (alive) status.value = next } catch (e) { if (alive) failure(e) }
  if (alive) timer = setTimeout(refresh, 1500)
}

async function downloadTicket() {
  error.value = ''
  issuingTicket.value = true
  try {
    const blob = await createTicket(ticketVersion.value, ticketSeconds.value!)
    const url = URL.createObjectURL(blob), link = document.createElement('a')
    link.href = url; link.download = 'download.ticket.json'; link.click(); URL.revokeObjectURL(url)
  } catch (e) { failure(e) }
  finally { issuingTicket.value = false }
}

async function publish() {
  submitting.value = true; error.value = ''
  try {
    await ElMessageBox.confirm(`确认发布版本 ${version.value}？将打包目录、当前已加载的加密 YAML 并上传至 OSS 发布 Bucket。`, '确认发布', { type: 'warning' })
    const submittedPassword = password.value
    password.value = ''
    status.value = await publishRelease(version.value, submittedPassword)
  } catch (e) { if (e !== 'cancel' && e !== 'close') failure(e) }
  finally { submitting.value = false }
}

onMounted(() => { refresh(); getSetup().then(next => { if (alive) runningBuild.value = next.runningBuild }).catch(failure) })
onUnmounted(() => { alive = false; clearTimeout(timer); password.value = '' })
</script>

<style scoped>
.release-container { max-width: 980px; }
.release-hero { align-items: center; }
.release-status {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  margin-bottom: 18px;
  border: 1px solid var(--hive-border);
  border-radius: var(--hive-radius-md);
  background: rgba(255, 255, 255, 0.78);
}
.release-status.state-complete { border-color: rgba(22, 163, 74, 0.25); }
.release-status.state-failed { border-color: rgba(220, 38, 38, 0.25); }
.status-indicator { width: 11px; height: 11px; flex: 0 0 auto; border-radius: 50%; background: var(--hive-warning); }
.status-indicator.is-active { background: var(--hive-primary); box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12); }
.status-indicator.is-ready { background: var(--hive-success); box-shadow: 0 0 0 4px rgba(22, 163, 74, 0.12); }
.state-failed .status-indicator { background: var(--hive-danger); }
.status-copy { display: grid; min-width: 0; gap: 3px; }
.status-copy strong { font-size: 0.95rem; }
.status-copy span, .build-info span { color: var(--hive-muted); font-size: 0.82rem; }
.build-info { display: grid; min-width: 0; gap: 4px; margin-left: auto; text-align: right; }
.build-info code { color: var(--hive-muted); font-size: 0.78rem; overflow-wrap: anywhere; }
.release-error { margin-bottom: 18px; }
.release-card, .ticket-card { padding: 6px 4px; }
.ticket-card { margin-top: 16px; }
.section-heading { display: flex; align-items: flex-start; gap: 14px; }
.section-heading h2 { margin: 0 0 6px; font-size: 1.1rem; letter-spacing: -0.02em; }
.section-heading p { margin: 0; color: var(--hive-muted); line-height: 1.6; }
.step-number { width: 34px; height: 34px; display: grid; place-items: center; flex: 0 0 auto; border-radius: 50%; color: var(--hive-primary); background: var(--hive-primary-soft); font-size: 0.84rem; font-weight: 800; }
.step-secondary { color: #0e7490; background: #cffafe; }
.release-form { margin: 20px 0 0 48px; }
.release-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 18px; max-width: 760px; }
.field-wide { grid-column: 1 / -1; }
.field-hint { margin-top: 6px; color: var(--hive-muted); font-size: 0.8rem; line-height: 1.5; }
.release-result { margin: 20px 0 0 48px; }
.release-hash { overflow-wrap: anywhere; }
.release-log { margin: 16px 0 0 48px; padding: 12px 14px 12px 34px; border-radius: 10px; color: var(--hive-muted); background: #f8fafc; }
.release-log li { margin: 6px 0; overflow-wrap: anywhere; line-height: 1.5; }
.ticket-form { display: grid; grid-template-columns: minmax(0, 1fr) minmax(180px, 0.6fr) auto; align-items: end; gap: 0 16px; margin: 20px 0 0 48px; }
.ticket-action { padding-bottom: 18px; }

@media (max-width: 680px) {
  .release-hero { align-items: flex-start; }
  .release-status { align-items: flex-start; flex-wrap: wrap; }
  .build-info { width: 100%; margin: 6px 0 0 25px; text-align: left; }
  .release-form, .release-result, .release-log, .ticket-form { margin-left: 0; }
  .release-fields { grid-template-columns: minmax(0, 1fr); }
  .field-wide { grid-column: auto; }
  .ticket-form { grid-template-columns: minmax(0, 1fr); gap: 0; }
  .ticket-action { padding-bottom: 0; }
}
</style>
