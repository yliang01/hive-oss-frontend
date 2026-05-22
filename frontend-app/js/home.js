import '../css/style.css';
import { showConfirm, showError, showInfo, showSuccess } from './utils.js';
import { renderTaskStatus, buildBackupListItemHTML, renderCategoryList } from './views/home-views.js';

const API_BASE = 'http://localhost:8080';

const PHASE_TEXT = {
  SUBMITTING: '提交任务中',
  PENDING: '任务处理中',
  UPLOADED: '备份已上传到 OSS',
  RESTORED: '恢复已完成',
  RESTART_NEEDED: '需要重启应用',
  FAILED: '任务失败',
  TIMEOUT: '状态查询超时'
};

let restoreInProgress = false;
let deleteInProgress = false;
const backupItemsByBatchId = new Map();

function setRestoreButtonsDisabled(disabled) {
  const buttons = document.querySelectorAll('.restore-btn');
  buttons.forEach(btn => {
    btn.disabled = disabled || btn.dataset.restoreAvailable !== '1';
  });
}

function setDeleteButtonsDisabled(disabled) {
  const buttons = document.querySelectorAll('.delete-backup-btn');
  buttons.forEach(btn => {
    btn.disabled = disabled || btn.dataset.deleteAvailable !== '1';
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
  backupItemsByBatchId.clear();
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
      const sortedItems = [...data.items].sort((a, b) => {
        const ta = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
      sortedItems.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        const canRestore = item.status === 'UPLOADED';
        const isLatest = index === 0;
        const canDelete = !isLatest;
        const batchIdEscaped = (item.batchId || '').replace(/'/g, "\\'");
        li.innerHTML = buildBackupListItemHTML(
          item,
          canRestore,
          restoreInProgress,
          batchIdEscaped,
          canDelete,
          deleteInProgress,
          isLatest
        );
        if (item.batchId) {
          backupItemsByBatchId.set(item.batchId, { ...item, isLatest });
        }
        listEl.appendChild(li);
      });
      setRestoreButtonsDisabled(restoreInProgress);
      setDeleteButtonsDisabled(restoreInProgress || deleteInProgress);
    })
    .catch(e => {
      showError(e.message);
      if (emptyEl) {
        emptyEl.textContent = '加载失败';
        emptyEl.style.display = 'block';
      }
    });
}

function handleDeleteBackup(batchId) {
  if (!batchId) return;
  if (restoreInProgress || deleteInProgress) return;
  const item = backupItemsByBatchId.get(batchId);
  if (item?.isLatest) {
    showInfo('最新备份不可删除');
    return;
  }
  const createdText = item?.createdAt ? new Date(item.createdAt).toLocaleString() : '-';
  const message = `
    确认删除该备份吗？<br>
    <span class="text-muted small">批次：${batchId}<br>时间：${createdText}</span><br><br>
    删除后将移除该备份的 3 个文件：archive / checksum / manifest。
  `;
  showConfirm(message, () => {
    doDeleteBackup(batchId);
  });
}

function doDeleteBackup(batchId) {
  deleteInProgress = true;
  setDeleteButtonsDisabled(true);
  setRestoreButtonsDisabled(true);
  fetch(`${API_BASE}/db-backup/${encodeURIComponent(batchId)}`, { method: 'DELETE' })
    .then(async (res) => {
      if (res.status === 404) throw new Error('备份不存在');
      if (res.status === 409) {
        let data = null;
        try {
          data = await res.json();
        } catch (_) {
          data = null;
        }
        throw new Error(data?.message || '最新备份不可删除');
      }
      if (!res.ok) {
        let data = null;
        try {
          data = await res.json();
        } catch (_) {
          data = null;
        }
        throw new Error(data?.message || '删除备份失败');
      }
    })
    .then(() => {
      showSuccess('备份删除成功');
      loadBackupList();
    })
    .catch((e) => {
      showError(e.message || '删除备份失败');
    })
    .finally(() => {
      deleteInProgress = false;
      setRestoreButtonsDisabled(restoreInProgress);
      setDeleteButtonsDisabled(restoreInProgress || deleteInProgress);
    });
}

function handleRestore(batchId) {
  if (!batchId) return;
  restoreInProgress = true;
  setRestoreButtonsDisabled(true);
  setDeleteButtonsDisabled(true);
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
        setDeleteButtonsDisabled(deleteInProgress);
      }, () => {
        restoreInProgress = false;
        setRestoreButtonsDisabled(false);
        setDeleteButtonsDisabled(deleteInProgress);
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
      setDeleteButtonsDisabled(deleteInProgress);
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
        const isRestartNeeded = status === 'RESTART_NEEDED';
        renderTaskStatus({
          taskType: 'RESTORE',
          batchId,
          phase,
          detail: data?.message || '',
          pollAttempts: attempts,
          elapsedSeconds,
          state: status === 'RESTORED' ? 'success' : status === 'FAILED' ? 'failed' : isRestartNeeded ? 'restart-needed' : 'running'
        });
        if (status === 'RESTORED') {
          if (onRestored) onRestored();
          return;
        }
        if (isRestartNeeded) {
          showError(data?.message || 'H2 恢复已准备好，请重启应用完成恢复');
          if (onEnd) onEnd();
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

// --- 分类选择 ---
function navigateToFiles(category) {
  window.location.href = window.location.origin + '/pages/files.html?category=' + encodeURIComponent(category.code);
}

function renderCategories(categories) {
  const ul = document.getElementById('categories');
  renderCategoryList(ul, categories, navigateToFiles);
}

function listCategories() {
  return fetch(`${API_BASE}/categories`)
    .then(res => {
      if (!res.ok) throw new Error('获取分类失败');
      return res.json();
    })
    .then(renderCategories)
    .catch(e => {
      showError(e.message);
      throw e;
    });
}

function refreshCategories() {
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.classList.add('spinning');
  }
  listCategories().finally(() => {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.classList.remove('spinning');
    }
  });
}

function onPageLoad() {
  refreshCategories();
  loadBackupList();
}

function goCategoryAdmin() {
  window.location.href = window.location.origin + '/pages/category-admin.html';
}

window.handleBackup = handleBackup;
window.handleRestore = handleRestore;
window.handleDeleteBackup = handleDeleteBackup;
window.loadBackupList = loadBackupList;
window.refreshCategories = refreshCategories;
window.goCategoryAdmin = goCategoryAdmin;
window.onload = onPageLoad;
