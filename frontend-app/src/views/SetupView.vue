<template>
  <main class="ops-page setup-page">
    <div class="ops-container setup-container">
      <header class="ops-hero setup-hero">
        <div>
          <div class="ops-kicker">Hive · FIRST START</div>
          <h1 class="ops-title">配置与启动</h1>
          <p class="ops-subtitle">先取得加密配置，再解锁启动业务。管理页面可以在业务配置尚未就绪时使用。</p>
        </div>
        <div v-if="status?.ready" class="ready-actions">
          <el-button @click="$router.push('/admin/release')">发布程序</el-button>
          <el-button type="primary" @click="$router.push('/')">进入业务</el-button>
        </div>
      </header>

      <section class="setup-status" :class="status?.ready ? 'is-ready' : 'is-locked'">
        <div class="status-indicator" :class="status?.ready ? 'is-ready' : 'is-locked'"></div>
        <div class="status-copy">
          <strong>{{ status?.ready ? '业务已启动' : stateLabel }}</strong>
          <span>{{ status?.message || (status?.ready ? '业务 API 已就绪' : '管理页面正常运行，等待业务配置') }}</span>
        </div>
        <div class="build-info">
          <span>当前程序</span>
          <code>{{ status?.runningBuild ?? '读取中…' }}</code>
        </div>
      </section>

      <el-alert v-if="error" class="setup-error" :title="error" type="error" :closable="false" />

      <el-card v-if="status?.ready" class="ready-card" shadow="never">
        <div class="ready-content">
          <div>
            <el-tag type="success" effect="light">运行中</el-tag>
            <h2>业务服务已就绪</h2>
            <p>{{ status.message }}</p>
          </div>
        </div>
      </el-card>

      <template v-else>
        <el-card class="flow-card" shadow="never">
          <div class="flow-heading">
            <div class="step-number">01</div>
            <div>
              <h2>准备加密配置</h2>
              <p>选择发布时取得的 ticket 文件，Hive 会从 OSS 下载对应的加密配置包。</p>
            </div>
          </div>

          <div class="ticket-row">
            <label class="file-picker">
              <input type="file" accept=".json,application/json" :disabled="busy" @change="selectTicket">
              <span class="file-picker-title">{{ ticketName || '选择 ticket JSON 文件' }}</span>
              <span class="file-picker-hint">{{ ticketName ? '已选择，准备下载' : '选择发布方提供的 download.ticket.json' }}</span>
            </label>
            <el-button type="primary" :disabled="busy || !ticket" :loading="busy && action === 'download'" @click="run('download', () => downloadConfiguration(ticket))">
              下载加密配置
            </el-button>
          </div>

          <div v-if="status?.candidate" class="candidate-panel">
            <el-tag type="success" effect="light">配置包已就绪</el-tag>
            <div class="candidate-copy">
              <strong>待解锁配置</strong>
              <code>{{ status.candidate }}</code>
            </div>
          </div>

          <div class="flow-connector"><span></span></div>

          <div class="flow-heading unlock-heading">
            <div class="step-number" :class="{ 'step-ready': !!status?.candidate }">02</div>
            <div>
              <h2>输入密码并启动</h2>
              <p>使用配置包对应的解锁密码。解密后的 YAML 只用于启动业务 context。</p>
            </div>
          </div>
          <div class="unlock-row">
            <el-input
              v-model="password"
              type="password"
              show-password
              autocomplete="off"
              placeholder="配置包解锁密码"
              :disabled="busy || !status?.candidate"
              @keyup.enter="unlock"
            />
            <el-button type="primary" :disabled="busy || !status?.candidate || !password" :loading="busy && action === 'unlock'" @click="unlock">
              解锁并启动业务
            </el-button>
          </div>
          <p class="flow-note">配置包下载后会保存在程序运行目录的 <code>.release/download</code> 中；成功启动后，下次启动仍需输入密码解锁。</p>
        </el-card>

        <el-collapse v-model="developerPanel" class="developer-panel">
          <el-collapse-item name="developer">
            <template #title>
              <span class="developer-title">开发机选项：使用本地 YAML</span>
            </template>
            <div class="developer-content">
              <p>仅用于开发调试：选择本地 YAML 并直接启动，不经过 OSS 下载流程。</p>
              <label class="file-picker yaml-picker">
                <input type="file" accept=".yml,.yaml,application/yaml,text/yaml" :disabled="busy" @change="selectYaml">
                <span class="file-picker-title">{{ yamlName || '选择秘密 YAML 文件' }}</span>
                <span class="file-picker-hint">{{ yamlName ? '文件内容已载入，尚未发送' : '支持 .yml 和 .yaml' }}</span>
              </label>
              <div class="developer-actions">
                <el-button :disabled="busy || !yaml" :loading="busy && action === 'local-yaml'" @click="run('local-yaml', () => loadSecretYaml(yaml))">
                  直接加载并启动
                </el-button>
              </div>
              <div class="developer-notes">
                <span><strong>直接加载：</strong>只用于本次启动，不保存配置包。</span>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </template>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getSetup, downloadConfiguration, unlockConfiguration, loadSecretYaml, type SetupStatus } from '@/api/setup'
import { readBase64 } from '@/utils/read-file'

const status = ref<SetupStatus>()
const password = ref('')
const ticket = ref('')
const ticketName = ref('')
const yaml = ref('')
const yamlName = ref('')
const busy = ref(false)
const action = ref('')
const error = ref('')
const developerPanel = ref<string[]>([])

const stateLabel = computed(() => {
  const labels: Record<string, string> = {
    locked: '等待解锁', downloading: '正在下载配置', starting: '正在启动业务', failed: '需要处理',
  }
  return labels[status.value?.state ?? ''] ?? '等待配置'
})

function failure(e: any) {
  error.value = e?.response?.data?.message ?? '操作失败，请检查文件和网络。'
}

async function run(name: string, task: () => Promise<SetupStatus>) {
  busy.value = true
  action.value = name
  error.value = ''
  try {
    status.value = await task()
  } catch (e) {
    failure(e)
    try { status.value = await getSetup() } catch {}
  } finally {
    busy.value = false
    action.value = ''
  }
}

async function selectTicket(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  ticket.value = file ? await file.text() : ''
  ticketName.value = file?.name ?? ''
}

async function selectYaml(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  yaml.value = file ? await readBase64(file) : ''
  yamlName.value = file?.name ?? ''
}

async function unlock() {
  const submittedPassword = password.value
  password.value = ''
  await run('unlock', () => unlockConfiguration(submittedPassword))
}

onMounted(() => run('initial', getSetup))
onUnmounted(() => {
  password.value = ''
  ticket.value = ''
  yaml.value = ''
})
</script>

<style scoped>
.setup-container { max-width: 980px; }
.setup-hero { align-items: center; }
.setup-status {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  margin-bottom: 18px;
  border: 1px solid var(--hive-border);
  border-radius: var(--hive-radius-md);
  background: rgba(255, 255, 255, 0.78);
}
.setup-status.is-ready { border-color: rgba(22, 163, 74, 0.25); }
.status-indicator { width: 11px; height: 11px; flex: 0 0 auto; border-radius: 50%; background: var(--hive-warning); }
.status-indicator.is-ready { background: var(--hive-success); box-shadow: 0 0 0 4px rgba(22, 163, 74, 0.12); }
.status-copy { display: grid; gap: 3px; }
.status-copy strong { font-size: 0.95rem; }
.status-copy span, .build-info span { color: var(--hive-muted); font-size: 0.82rem; }
.build-info { display: grid; gap: 4px; margin-left: auto; text-align: right; }
.build-info code, .candidate-copy code { color: var(--hive-muted); font-size: 0.78rem; overflow-wrap: anywhere; }
.setup-error { margin-bottom: 18px; }
.flow-card { padding: 6px 4px; }
.flow-heading { display: flex; align-items: flex-start; gap: 14px; }
.flow-heading h2, .ready-content h2 { margin: 0 0 6px; font-size: 1.1rem; letter-spacing: -0.02em; }
.flow-heading p, .ready-content p, .developer-content > p { margin: 0; color: var(--hive-muted); line-height: 1.6; }
.step-number { width: 34px; height: 34px; display: grid; place-items: center; flex: 0 0 auto; border-radius: 50%; color: var(--hive-primary); background: var(--hive-primary-soft); font-size: 0.84rem; font-weight: 800; }
.step-number.step-ready { color: #15803d; background: #dcfce7; }
.ticket-row { display: flex; align-items: center; gap: 14px; margin: 20px 0 0 48px; }
.file-picker { position: relative; display: flex; min-width: 0; min-height: 56px; flex: 1; flex-direction: column; justify-content: center; gap: 3px; padding: 10px 14px; overflow: hidden; border: 1px dashed #b8c7da; border-radius: 12px; background: #fbfdff; cursor: pointer; transition: border-color .18s ease, background .18s ease; }
.file-picker:hover { border-color: var(--hive-primary); background: #f5f9ff; }
.file-picker input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
.file-picker-title { overflow: hidden; color: var(--hive-text); font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.file-picker-hint { color: var(--hive-muted); font-size: 0.78rem; }
.candidate-panel { display: flex; align-items: flex-start; gap: 12px; margin: 16px 0 0 48px; padding: 12px 14px; border: 1px solid rgba(22, 163, 74, 0.2); border-radius: 12px; background: #f5fbf6; }
.candidate-copy { display: grid; min-width: 0; gap: 4px; }
.candidate-copy code { word-break: break-all; }
.flow-connector { height: 38px; margin-left: 16px; border-left: 1px solid var(--hive-border); }
.flow-connector span { display: none; }
.unlock-heading { margin-bottom: 16px; }
.unlock-row { display: flex; max-width: 620px; gap: 12px; margin-left: 48px; }
.unlock-row .el-input { flex: 1; }
.flow-note { margin: 12px 0 0 48px; color: var(--hive-muted); font-size: 0.82rem; line-height: 1.55; }
.flow-note code, .developer-notes code { color: #344054; }
.developer-panel { margin-top: 16px; border: 1px solid var(--hive-border-soft); border-radius: var(--hive-radius-lg); background: rgba(255, 255, 255, 0.8); box-shadow: var(--hive-shadow-soft); }
.developer-panel :deep(.el-collapse-item__header) { padding: 0 20px; border-radius: var(--hive-radius-lg); background: transparent; }
.developer-panel :deep(.el-collapse-item__wrap) { border-radius: 0 0 var(--hive-radius-lg) var(--hive-radius-lg); background: transparent; }
.developer-panel :deep(.el-collapse-item__content) { padding: 0 20px 20px; }
.developer-title { color: var(--hive-text); font-weight: 700; }
.developer-content { display: grid; gap: 14px; }
.yaml-picker { width: 100%; }
.developer-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.developer-notes { display: grid; gap: 6px; padding: 12px 14px; border-radius: 10px; color: var(--hive-muted); background: #f8fafc; font-size: 0.82rem; line-height: 1.5; }
.ready-card { border-color: rgba(22, 163, 74, 0.18); }
.ready-content { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.ready-content h2 { margin-top: 12px; }
.ready-actions { display: flex; flex-wrap: wrap; gap: 8px; }

@media (max-width: 680px) {
  .setup-hero { align-items: flex-start; }
  .setup-status { align-items: flex-start; flex-wrap: wrap; }
  .build-info { width: 100%; margin: 6px 0 0 25px; text-align: left; }
  .ticket-row, .unlock-row { align-items: stretch; flex-direction: column; margin-left: 0; }
  .candidate-panel, .flow-note { margin-left: 0; }
  .flow-connector { margin-left: 16px; }
  .ready-content { align-items: flex-start; flex-direction: column; }
  .developer-panel :deep(.el-collapse-item__content) { padding-right: 14px; padding-left: 14px; }
  .developer-actions .el-button { min-height: 40px; }
}
</style>
