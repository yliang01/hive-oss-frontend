/**
 * 首页展示层：任务状态面板、备份列表项、分类列表的 DOM 渲染。
 * 逻辑与 API 调用保留在 home.js。
 */

const TASK_TYPE_TEXT = {
  BACKUP: '数据库备份',
  RESTORE: '数据库恢复'
};

function formatLocalTime(date) {
  return date.toLocaleTimeString('zh-CN', { hour12: false });
}

export function renderTaskStatus(options) {
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

/**
 * 生成单条备份历史项的 HTML。batchIdEscaped 为已转义用于 onclick 的 batchId。
 */
export function buildBackupListItemHTML(item, canRestore, restoreInProgress, batchIdEscaped, canDelete, deleteInProgress, isLatest) {
  const created = item.createdAt ? new Date(item.createdAt).toLocaleString() : '-';
  const deleteDisabled = !canDelete || deleteInProgress || restoreInProgress;
  const deleteTitle = isLatest ? '最新备份不可删除' : '';
  return `
    <div class="small">
      <span class="fw-bold">${item.batchId || '-'}</span>
      <span class="text-muted"> ${item.database || ''}</span>
      <span class="badge bg-secondary ms-1">${item.status || '-'}</span>
      <br><span class="text-muted">${created}</span>
    </div>
    <div class="d-flex gap-2">
      <button
        type="button"
        class="btn btn-sm btn-ui-compact btn-outline-primary restore-btn"
        data-restore-available="${canRestore ? '1' : '0'}"
        ${!canRestore || restoreInProgress ? 'disabled' : ''}
        onclick="handleRestore('${batchIdEscaped}')"
      >
        恢复
      </button>
      <button
        type="button"
        class="btn btn-sm btn-ui-compact btn-outline-danger delete-backup-btn"
        data-delete-available="${canDelete ? '1' : '0'}"
        title="${deleteTitle}"
        ${deleteDisabled ? 'disabled' : ''}
        onclick="handleDeleteBackup('${batchIdEscaped}')"
      >
        删除
      </button>
    </div>
  `;
}

export function renderCategoryList(containerEl, categories, onCategoryClick) {
  if (!containerEl) return;
  containerEl.innerHTML = '';
  if (!categories.length) {
    containerEl.innerHTML = '<li class="list-group-item text-center text-secondary">暂无分类</li>';
    return;
  }
  categories.forEach(category => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="d-flex justify-content-between align-items-start gap-2">
        <div>
          <div class="fw-semibold">${category.name || category.code || '-'}</div>
          <div class="text-muted small">${category.description || ''}</div>
        </div>
        <span class="badge text-bg-light">${category.code || '-'}</span>
      </div>
    `;
    li.className = 'list-group-item list-group-item-action';
    li.style.cursor = 'pointer';
    li.addEventListener('click', () => onCategoryClick(category));
    containerEl.appendChild(li);
  });
}
