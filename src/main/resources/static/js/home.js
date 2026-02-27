import { showError, showInfo, showSuccess } from './utils.js';

const API_BASE = 'http://localhost:8080';
const TASK_TYPE_TEXT = {
  BACKUP: '数据库备份',
  RESTORE: '数据库恢复'
};

const PHASE_TEXT = {
  SUBMITTING: '提交任务中',
  PENDING: '任务处理中',
  UPLOADED: '备份已上传到 OSS',
  RESTORED: '恢复已完成',
  FAILED: '任务失败',
  TIMEOUT: '状态查询超时'
};

let restoreInProgress = false;

function formatLocalTime(date) {
  return date.toLocaleTimeString('zh-CN', { hour12: false });
}

function renderTaskStatus(options) {
  const {
    visible = true,
    taskType = '-',
    batchId = '-',
    phase = '',
    detail = '',
    pollAttempts = 0,
    elapsedSeconds = 0,
    state = 'running'
  } = options || {};

  const panelEl = document.getElementById('backup-ack-status');
  const badgeEl = document.getElementById('backup-status-badge');
  const updatedAtEl = document.getElementById('backup-status-updated-at');
  const typeEl = document.getElementById('backup-task-type');
  const batchEl = document.getElementById('backup-task-batch-id');
  const phaseEl = document.getElementById('backup-task-phase');
  const detailRowEl = document.getElementById('backup-task-detail-row');
  const detailEl = document.getElementById('backup-task-detail');
  const attemptsEl = document.getElementById('backup-task-poll-attempts');
  const elapsedEl = document.getElementById('backup-task-elapsed');
  if (!panelEl || !badgeEl || !updatedAtEl || !typeEl || !batchEl || !phaseEl || !detailRowEl || !detailEl || !attemptsEl || !elapsedEl) {
    return;
  }

  panelEl.style.display = visible ? 'block' : 'none';
  panelEl.classList.remove('is-running', 'is-success', 'is-failed');
  badgeEl.classList.remove('text-bg-secondary', 'text-bg-primary', 'text-bg-success', 'text-bg-danger');

  if (state === 'success') {
    panelEl.classList.add('is-success');
    badgeEl.classList.add('text-bg-success');
    badgeEl.textContent = '已完成';
  } else if (state === 'failed') {
    panelEl.classList.add('is-failed');
    badgeEl.classList.add('text-bg-danger');
    badgeEl.textContent = '失败';
  } else {
    panelEl.classList.add('is-running');
    badgeEl.classList.add('text-bg-primary');
    badgeEl.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>进行中';
  }

  typeEl.textContent = TASK_TYPE_TEXT[taskType] || taskType;
  batchEl.textContent = batchId || '-';
  phaseEl.textContent = phase || '-';
  updatedAtEl.textContent = `更新时间：${formatLocalTime(new Date())}`;
  attemptsEl.textContent = `轮询 ${pollAttempts} 次`;
  elapsedEl.textContent = `已耗时 ${elapsedSeconds} 秒`;

  const normalizedDetail = (detail || '').trim();
  if (normalizedDetail) {
    detailEl.textContent = normalizedDetail;
    detailRowEl.style.display = 'block';
  } else {
    detailEl.textContent = '';
    detailRowEl.style.display = 'none';
  }
}

function setRestoreButtonsDisabled(disabled) {
  const buttons = document.querySelectorAll('.restore-btn');
  buttons.forEach(btn => {
    btn.disabled = disabled || btn.dataset.restoreAvailable !== '1';
  });
}

function handleBackup() {
  const btn = document.getElementById('backup-btn');
  if (btn) btn.disabled = true;
  const startedAt = Date.now();
  renderTaskStatus({
    taskType: 'BACKUP',
    batchId: '-',
    phase: PHASE_TEXT.SUBMITTING,
    state: 'running'
  });

  fetch(`${API_BASE}/db-backup/backup`, { method: 'POST' })
    .then(res => {
      if (!res.ok) throw new Error('触发备份失败');
      return res.json();
    })
    .then(data => {
      const batchId = data.batchId;
      renderTaskStatus({
        taskType: 'BACKUP',
        batchId,
        phase: PHASE_TEXT.PENDING,
        detail: data.message || '备份任务已受理，等待上传完成',
        elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000),
        state: 'running'
      });
      pollBackupAck(batchId, () => {
        showSuccess('备份已上传至 OSS');
        loadBackupList();
        if (btn) btn.disabled = false;
      }, () => {
        if (btn) btn.disabled = false;
      }, startedAt);
    })
    .catch(e => {
      showError(e.message);
      renderTaskStatus({
        taskType: 'BACKUP',
        phase: PHASE_TEXT.FAILED,
        detail: e.message,
        elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000),
        state: 'failed'
      });
      if (btn) btn.disabled = false;
    });
}

function pollBackupAck(batchId, onUploaded, onEnd, startedAt) {
  const maxAttempts = 300;
  let attempts = 0;
  function poll() {
    attempts++;
    const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
    fetch(`${API_BASE}/db-backup/ack/${encodeURIComponent(batchId)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          const status = (data.status || 'PENDING').toUpperCase();
          const phase = PHASE_TEXT[status] || PHASE_TEXT.PENDING;
          const detail = data.message || '';
          renderTaskStatus({
            taskType: 'BACKUP',
            batchId,
            phase,
            detail,
            pollAttempts: attempts,
            elapsedSeconds,
            state: status === 'UPLOADED' ? 'success' : status === 'FAILED' ? 'failed' : 'running'
          });
          if (status === 'UPLOADED') {
            if (onUploaded) onUploaded();
            return;
          }
          if (status === 'FAILED') {
            showError(detail || '备份失败');
            if (onEnd) onEnd();
            return;
          }
        } else {
          renderTaskStatus({
            taskType: 'BACKUP',
            batchId,
            phase: PHASE_TEXT.PENDING,
            detail: '状态查询暂无结果，继续重试',
            pollAttempts: attempts,
            elapsedSeconds,
            state: 'running'
          });
        }
        if (attempts < maxAttempts) setTimeout(poll, 2000);
        else {
          showError('轮询超时');
          renderTaskStatus({
            taskType: 'BACKUP',
            batchId,
            phase: PHASE_TEXT.TIMEOUT,
            detail: '请稍后手动刷新备份列表确认结果',
            pollAttempts: attempts,
            elapsedSeconds,
            state: 'failed'
          });
          if (onEnd) onEnd();
        }
      })
      .catch(() => {
        renderTaskStatus({
          taskType: 'BACKUP',
          batchId,
          phase: PHASE_TEXT.PENDING,
          detail: '状态查询失败，正在重试',
          pollAttempts: attempts,
          elapsedSeconds,
          state: 'running'
        });
        if (attempts < maxAttempts) setTimeout(poll, 2000);
        else {
          showError('轮询超时');
          renderTaskStatus({
            taskType: 'BACKUP',
            batchId,
            phase: PHASE_TEXT.TIMEOUT,
            detail: '请稍后手动刷新备份列表确认结果',
            pollAttempts: attempts,
            elapsedSeconds,
            state: 'failed'
          });
          if (onEnd) onEnd();
        }
      });
  }
  poll();
}

function loadBackupList() {
  const listEl = document.getElementById('backup-list');
  const emptyEl = document.getElementById('backup-list-empty');
  if (!listEl) return;
  listEl.innerHTML = '';
  if (emptyEl) emptyEl.textContent = '加载中…';
  fetch(`${API_BASE}/db-backup/backups`)
    .then(res => {
      if (!res.ok) throw new Error('获取备份列表失败');
      return res.json();
    })
    .then(data => {
      if (emptyEl) emptyEl.style.display = 'none';
      if (!data.items || !data.items.length) {
        if (emptyEl) {
          emptyEl.textContent = '暂无备份';
          emptyEl.style.display = 'block';
        }
        return;
      }
      data.items.forEach(item => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        const created = item.createdAt ? new Date(item.createdAt).toLocaleString() : '-';
        const canRestore = item.status === 'UPLOADED';
        li.innerHTML = `
          <div class="small">
            <span class="fw-bold">${item.batchId || '-'}</span>
            <span class="text-muted"> ${item.database || ''}</span>
            <span class="badge bg-secondary ms-1">${item.status || '-'}</span>
            <br><span class="text-muted">${created}</span>
          </div>
          <button
            type="button"
            class="btn btn-sm btn-outline-primary restore-btn"
            data-restore-available="${canRestore ? '1' : '0'}"
            ${!canRestore || restoreInProgress ? 'disabled' : ''}
            onclick="handleRestore('${(item.batchId || '').replace(/'/g, "\\'")}')"
          >
            恢复
          </button>
        `;
        listEl.appendChild(li);
      });
      setRestoreButtonsDisabled(restoreInProgress);
    })
    .catch(e => {
      showError(e.message);
      if (emptyEl) {
        emptyEl.textContent = '加载失败';
        emptyEl.style.display = 'block';
      }
    });
}

function handleRestore(batchId) {
  if (!batchId) return;
  restoreInProgress = true;
  setRestoreButtonsDisabled(true);
  const startedAt = Date.now();
  renderTaskStatus({
    taskType: 'RESTORE',
    batchId,
    phase: PHASE_TEXT.SUBMITTING,
    state: 'running'
  });

  fetch(`${API_BASE}/db-backup/restore/${encodeURIComponent(batchId)}`, { method: 'POST' })
    .then(res => {
      if (res.status === 404) throw new Error('备份不存在');
      if (res.status === 409) return res.json().then(d => { throw new Error(d.message || '无法恢复'); });
      if (!res.ok) throw new Error('触发恢复失败');
      return res.json();
    })
    .then(data => {
      const initialStatus = (data?.status || 'PENDING').toUpperCase();
      const initialPhase = PHASE_TEXT[initialStatus] || PHASE_TEXT.PENDING;
      renderTaskStatus({
        taskType: 'RESTORE',
        batchId,
        phase: initialPhase,
        detail: data?.message || '',
        elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000),
        state: 'running'
      });
      pollRestoreAck(batchId, () => {
        showSuccess('数据库已恢复');
        loadBackupList();
        restoreInProgress = false;
        setRestoreButtonsDisabled(false);
      }, () => {
        restoreInProgress = false;
        setRestoreButtonsDisabled(false);
      }, startedAt);
    })
    .catch(e => {
      showError(e.message);
      renderTaskStatus({
        taskType: 'RESTORE',
        batchId,
        phase: PHASE_TEXT.FAILED,
        detail: e.message,
        elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000),
        state: 'failed'
      });
      restoreInProgress = false;
      setRestoreButtonsDisabled(false);
    });
}

function pollRestoreAck(batchId, onRestored, onEnd, startedAt) {
  const maxAttempts = 300;
  let attempts = 0;
  function poll() {
    attempts++;
    const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
    fetch(`${API_BASE}/db-backup/ack/${encodeURIComponent(batchId)}`)
      .then(res => {
        if (!res.ok) throw new Error('查询恢复状态失败');
        return res.json();
      })
      .then(data => {
        const status = (data?.status || 'PENDING').toUpperCase();
        const phase = PHASE_TEXT[status] || PHASE_TEXT.PENDING;
        renderTaskStatus({
          taskType: 'RESTORE',
          batchId,
          phase,
          detail: data?.message || '',
          pollAttempts: attempts,
          elapsedSeconds,
          state: status === 'RESTORED' ? 'success' : status === 'FAILED' ? 'failed' : 'running'
        });
        if (status === 'RESTORED') {
          if (onRestored) onRestored();
          return;
        }
        if (status === 'FAILED') {
          showError(data.message || '恢复失败');
          if (onEnd) onEnd();
          return;
        }
        if (attempts < maxAttempts) setTimeout(poll, 2000);
        else {
          showError('轮询超时');
          renderTaskStatus({
            taskType: 'RESTORE',
            batchId,
            phase: PHASE_TEXT.TIMEOUT,
            detail: '请稍后手动查询该批次状态',
            pollAttempts: attempts,
            elapsedSeconds,
            state: 'failed'
          });
          if (onEnd) onEnd();
        }
      })
      .catch(() => {
        renderTaskStatus({
          taskType: 'RESTORE',
          batchId,
          phase: PHASE_TEXT.PENDING,
          detail: '状态查询失败，正在重试',
          pollAttempts: attempts,
          elapsedSeconds,
          state: 'running'
        });
        if (attempts < maxAttempts) setTimeout(poll, 2000);
        else {
          showError('轮询超时');
          renderTaskStatus({
            taskType: 'RESTORE',
            batchId,
            phase: PHASE_TEXT.TIMEOUT,
            detail: '请稍后手动查询该批次状态',
            pollAttempts: attempts,
            elapsedSeconds,
            state: 'failed'
          });
          if (onEnd) onEnd();
        }
      });
  }
  poll();
}

// --- Bucket 选择 ---
function navigateToFiles(bucket) {
  window.location.href = window.location.origin + '/pages/files.html?bucket=' + encodeURIComponent(bucket);
}

function renderBuckets(buckets) {
  const ul = document.getElementById('buckets');
  if (!ul) return;
  ul.innerHTML = '';

  if (!buckets.length) {
    ul.innerHTML = '<li class="list-group-item text-center text-secondary">暂无 Bucket</li>';
    return;
  }

  buckets.forEach(bucket => {
    const li = document.createElement('li');
    li.textContent = bucket;
    li.className = 'list-group-item list-group-item-action';
    li.style.cursor = 'pointer';
    li.addEventListener('click', () => navigateToFiles(bucket));
    ul.appendChild(li);
  });
}

function listBuckets() {
  return fetch(`${API_BASE}/buckets`)
    .then(res => {
      if (!res.ok) throw new Error('获取 bucket 失败');
      return res.json();
    })
    .then(renderBuckets)
    .catch(e => {
      showError(e.message);
      throw e;
    });
}

function refreshBuckets() {
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.classList.add('spinning');
  }
  listBuckets().finally(() => {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.classList.remove('spinning');
    }
  });
}

function onPageLoad() {
  refreshBuckets();
  loadBackupList();
}

window.handleBackup = handleBackup;
window.handleRestore = handleRestore;
window.loadBackupList = loadBackupList;
window.refreshBuckets = refreshBuckets;
window.onload = onPageLoad;
