import '../css/style.css';
import { formatSize, formatDate, showError, showSuccess, showWarning, showInfo, showConfirm } from './utils.js';
import { generateFileRowHTML as generateFileRowHTMLView, buildExpandedDetailRow as buildExpandedDetailRowView } from './views/files-views.js';

const API_BASE = 'http://localhost:8080';
const pageSize = 50;
let currentPage = 1;
let totalFiles = 0;
let currentCategory = '';
let currentGroupId = '';
let currentSearchKeyword = ''; // 当前搜索关键词
let categoryMeta = null;
const selectedFileKeys = new Set();

let expandedFileKey = null; // 当前展开详情的行（同一时间只展开一行）
let previewModalInstance = null;
let viewMode = 'list'; // 'list' | 'grid'

function getRowByFileKey(fileKey) {
  const tbody = document.querySelector('#file-table tbody');
  if (!tbody) return null;
  for (const tr of tbody.querySelectorAll('tr[data-filekey]')) {
    if (tr.getAttribute('data-filekey') === fileKey) return tr;
  }
  return null;
}

function getDownloadButtonByFileKey(fileKey) {
  const row = getRowByFileKey(fileKey);
  return row ? row.querySelector('.download-btn') : null;
}

function escapeHtml(str) {
  if (str == null) return '';
  const s = String(str);
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeHtmlAttr(str) {
  if (str == null) return '';
  return escapeHtml(str);
}

function escapeJsString(str) {
  if (str == null) return '';
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '\\r').replace(/\n/g, '\\n');
}

// 获取当前 category
function getCurrentCategory() {
  const url = new URL(window.location.href);
  return url.searchParams.get('category');
}

// 返回首页（分类入口）
function backToCategories() {
  window.location.href = window.location.origin + '/';
}

function applyCategoryTheme() {
  const titleEl = document.getElementById('current-category');
  if (titleEl) {
    titleEl.textContent = categoryMeta?.name || currentCategory;
  }
  document.body.classList.remove('category-image', 'category-hot', 'category-archive');
  if (categoryMeta?.uiVariant === 'image') {
    document.body.classList.add('category-image');
  } else if (categoryMeta?.uiVariant === 'archive') {
    document.body.classList.add('category-archive');
  } else {
    document.body.classList.add('category-hot');
  }
}

function loadCategoryMetaAndGroups() {
  currentCategory = getCurrentCategory();
  if (!currentCategory) {
    showError('未指定分类');
    return Promise.reject(new Error('未指定分类'));
  }
  const categoriesReq = fetch(`${API_BASE}/categories`)
    .then(res => {
      if (!res.ok) throw new Error('获取分类失败');
      return res.json();
    })
    .then(categories => {
      categoryMeta = (categories || []).find(item => item.code === currentCategory) || null;
      applyCategoryTheme();
    });
  const groupsReq = fetch(`${API_BASE}/categories/${currentCategory}/groups`)
    .then(res => {
      if (!res.ok) throw new Error('获取分组失败');
      return res.json();
    })
    .then(groups => {
      const select = document.getElementById('group-select');
      const assignSelect = document.getElementById('assign-group-select');
      if (!select) return;
      select.innerHTML = '<option value="">未分组</option>';
      if (assignSelect) {
        assignSelect.innerHTML = '<option value="">选择目标分组</option>';
      }
      (groups || []).forEach(group => {
        const option = document.createElement('option');
        option.value = String(group.groupId);
        option.textContent = group.groupName || group.groupCode || String(group.groupId);
        select.appendChild(option);
        if (assignSelect) {
          const copied = option.cloneNode(true);
          assignSelect.appendChild(copied);
        }
      });
      select.value = currentGroupId !== undefined && currentGroupId !== null ? currentGroupId : '';
    });
  return Promise.all([categoriesReq, groupsReq]);
}

function changeGroupFilter(groupId) {
  currentGroupId = groupId || '';
  currentPage = 1;
  listFiles();
}

// 新增：刷新单个文件信息
function refreshSingleFile(fileKey) {
  const currentCategory = getCurrentCategory();
  if (!currentCategory) {
    showError('未指定分类');
    return;
  }
  
  fetch(`${API_BASE}/categories/${currentCategory}/files/${fileKey}`)
    .then(res => {
      if (!res.ok) throw new Error('获取文件信息失败');
      return res.json();
    })
    .then(fileData => {
      updateFileRow(fileKey, fileData);
      // 同步更新全局缓存的文件列表
      if (window.allFiles && Array.isArray(window.allFiles)) {
        const idx = window.allFiles.findIndex(f => f.fileKey === fileKey);
        if (idx >= 0) {
          window.allFiles[idx] = fileData;
        }
      }
      // 根据最新状态更新“确认删除”按钮
      updateConfirmDeleteButtonState(fileData);
    })
    .catch(e => showError(e.message));
}

// 新增：更新文件行内容
function updateFileRow(fileKey, fileData) {
  const tbody = document.querySelector('#file-table tbody');
  if (!tbody) return;
  let row = null;
  for (const tr of tbody.querySelectorAll('tr[data-filekey]')) {
    if (tr.getAttribute('data-filekey') === fileKey) { row = tr; break; }
  }
  if (!row) return;
  row.innerHTML = generateFileRowHTML(fileData);
  const next = row.nextElementSibling;
  if (next && next.classList && next.classList.contains('row-expand-panel-row')) {
    const td = next.querySelector('td.row-expand-panel');
    if (td) {
      td.innerHTML = buildExpandedDetailRow(fileData);
      td.querySelectorAll('.copy-file-name-btn').forEach(btn => btn.addEventListener('click', () => copyFileNameFromPanel(btn)));
      td.querySelectorAll('.copy-file-key-btn').forEach(btn => btn.addEventListener('click', () => copyFileKeyFromPanel(btn)));
    }
  }
}

// 新增：将新文件添加到列表最上端
function addNewFileToTop(fileData) {
  const tbody = document.querySelector('#file-table tbody');
  
  // 如果当前显示的是"暂无文件"，先清空
  if (tbody.innerHTML.includes('暂无文件')) {
    tbody.innerHTML = '';
  }
  
  // 创建新的文件行
  const tr = document.createElement('tr');
  tr.setAttribute('data-filekey', fileData.fileKey);
  tr.innerHTML = generateFileRowHTML(fileData);
  
  // 添加到表格的最上端
  if (tbody.firstChild) {
    tbody.insertBefore(tr, tbody.firstChild);
  } else {
    tbody.appendChild(tr);
  }
  
  // 添加高亮效果
  tr.classList.add('new-file-highlight');
  
  // 2秒后移除动画类
  setTimeout(() => {
    tr.classList.remove('new-file-highlight');
  }, 2000);
}

function buildExpandedDetailRow(file) {
  return buildExpandedDetailRowView(file, currentSearchKeyword);
}

/** 切换行展开详情：同一时间只展开一行 */
function toggleExpandDetail(fileKey) {
  const tbody = document.querySelector('#file-table tbody');
  if (!tbody) return;
  let row = null;
  for (const tr of tbody.querySelectorAll('tr[data-filekey]')) {
    if (tr.getAttribute('data-filekey') === fileKey) { row = tr; break; }
  }
  if (!row) return;
  const next = row.nextElementSibling;
  const isExpandRow = next && next.classList && next.classList.contains('row-expand-panel-row');
  if (isExpandRow) {
    next.remove();
    expandedFileKey = null;
    return;
  }
  // 关闭其他展开行
  const prevExpand = tbody.querySelector('tr.row-expand-panel-row');
  if (prevExpand) prevExpand.remove();
  expandedFileKey = fileKey;
  const file = (window.allFiles && window.allFiles.find(f => f.fileKey === fileKey)) || { fileKey, fileName: '' };
  const td = document.createElement('td');
  td.colSpan = 10;
  td.className = 'row-expand-panel';
  td.innerHTML = buildExpandedDetailRow(file);
  const tr = document.createElement('tr');
  tr.className = 'row-expand-panel-row';
  tr.appendChild(td);
  row.parentNode.insertBefore(tr, row.nextSibling);
  // 绑定复制按钮
  td.querySelectorAll('.copy-file-name-btn').forEach(btn => {
    btn.addEventListener('click', () => copyFileNameFromPanel(btn));
  });
  td.querySelectorAll('.copy-file-key-btn').forEach(btn => {
    btn.addEventListener('click', () => copyFileKeyFromPanel(btn));
  });
}

function copyFileNameFromPanel(btn) {
  const panel = btn.closest('.row-expand-content');
  if (!panel) return;
  const name = panel.getAttribute('data-file-name') || '';
  copyToClipboardWithFeedback(name, btn, '已复制');
}

function copyFileKeyFromPanel(btn) {
  const panel = btn.closest('.row-expand-content');
  if (!panel) return;
  const key = panel.getAttribute('data-file-key') || '';
  copyToClipboardWithFeedback(key, btn, '已复制');
}

function copyToClipboardWithFeedback(text, buttonEl, doneText) {
  navigator.clipboard.writeText(text).then(() => {
    showSuccess(doneText);
    const orig = buttonEl.textContent;
    buttonEl.textContent = doneText;
    buttonEl.classList.add('copy-btn-done');
    setTimeout(() => {
      buttonEl.textContent = orig;
      buttonEl.classList.remove('copy-btn-done');
    }, 1200);
  }).catch(() => showError('复制失败'));
}

function generateFileRowHTML(file) {
  return generateFileRowHTMLView(file, currentSearchKeyword);
}

// 渲染文件列表（表格）
function renderFiles(files) {
  const tbody = document.querySelector('#file-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const confirmDeleteBtn = document.getElementById('sync-local-btn');
  const hasDeletable = files.some(f => f.status === 'DB_ONLY' || f.status === 'TO_BE_DELETED');
  if (confirmDeleteBtn) {
    confirmDeleteBtn.disabled = !hasDeletable;
    confirmDeleteBtn.title = hasDeletable ? '' : '没有可确认删除的文件';
  }

  if (!files.length) {
    if (currentSearchKeyword.trim()) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center text-secondary">未找到包含"${escapeHtml(currentSearchKeyword)}"的文件</td></tr>`;
    } else {
      tbody.innerHTML = '<tr><td colspan="10" class="text-center text-secondary">暂无文件</td></tr>';
    }
    return;
  }

  files.forEach(file => {
    const tr = document.createElement('tr');
    tr.setAttribute('data-filekey', file.fileKey);
    tr.innerHTML = generateFileRowHTML(file);
    tbody.appendChild(tr);
  });
}

// 根据当前列表或最新记录状态，更新“确认删除”按钮可用性
function updateConfirmDeleteButtonState(latestFile) {
  const confirmDeleteBtn = document.getElementById('sync-local-btn');
  if (!confirmDeleteBtn) return;
  let hasDeletable = false;
  if (window.allFiles && Array.isArray(window.allFiles)) {
    hasDeletable = window.allFiles.some(f => f.status === 'DB_ONLY' || f.status === 'TO_BE_DELETED');
  } else if (latestFile) {
    hasDeletable = latestFile.status === 'DB_ONLY' || latestFile.status === 'TO_BE_DELETED';
  }
  confirmDeleteBtn.disabled = !hasDeletable;
  confirmDeleteBtn.title = hasDeletable ? '' : '没有可确认删除的文件';
}

// 渲染网格视图（缩略图优先，失败回退预览图）
function renderFilesGrid(files) {
  const gridEl = document.getElementById('files-grid');
  const listWrap = document.getElementById('files-list-view');
  const gridWrap = document.getElementById('files-grid-view');
  if (!gridEl || !listWrap || !gridWrap) return;

  const confirmDeleteBtn = document.getElementById('sync-local-btn');
  const hasDeletable = files.some(f => f.status === 'DB_ONLY' || f.status === 'TO_BE_DELETED');
  if (confirmDeleteBtn) {
    confirmDeleteBtn.disabled = !hasDeletable;
    confirmDeleteBtn.title = hasDeletable ? '' : '没有可确认删除的文件';
  }

  gridEl.innerHTML = '';
  if (!files.length) {
    gridEl.innerHTML = `<div class="col-12 text-center text-secondary py-5">${currentSearchKeyword.trim() ? `未找到包含"${escapeHtml(currentSearchKeyword)}"的文件` : '暂无文件'}</div>`;
    return;
  }

  files.forEach(file => {
    const card = document.createElement('div');
    card.className = 'col-6 col-md-4 col-lg-3';
    card.setAttribute('data-filekey', file.fileKey);
    const thumbUrl = buildPreviewUrl(file.thumbnailUrl || file.previewUrl);
    const previewUrl = buildPreviewUrl(file.previewUrl);
    const keyEsc = escapeJsString(file.fileKey);
    const fileNameDisplay = escapeHtml((file.fileName || file.fileKey || '').slice(0, 40)) + ((file.fileName && file.fileName.length > 40) ? '…' : '');
    card.innerHTML = `
      <div class="card files-grid-card h-100">
        <div class="files-grid-card-img-wrap">
          <img class="files-grid-card-img" src="${escapeHtmlAttr(thumbUrl)}" alt="${escapeHtmlAttr(file.fileName || file.fileKey)}"
               data-preview-url="${escapeHtmlAttr(previewUrl)}" data-filekey="${escapeHtmlAttr(file.fileKey)}"
               onerror="handleGridThumbError(this)">
        </div>
        <div class="card-body py-2">
          <p class="card-text text-truncate small mb-1" title="${escapeHtmlAttr(file.fileName || file.fileKey)}">${fileNameDisplay}</p>
          <div class="d-flex gap-1 flex-wrap">
            ${file.previewable && file.previewUrl ? `<button class="btn btn-sm btn-outline-primary" onclick="previewFile('${keyEsc}')" title="预览">预览</button>` : ''}
            <button class="btn btn-sm btn-outline-secondary" onclick="downloadFile('${keyEsc}')" ${file.downloadable === false ? 'disabled' : ''}>下载</button>
          </div>
        </div>
      </div>
    `;
    gridEl.appendChild(card);
  });
}

function handleGridThumbError(imgEl) {
  const previewUrl = imgEl.getAttribute('data-preview-url');
  const currentSrc = imgEl.getAttribute('src');
  // 缩略图加载失败时不再回退到原图，只展示占位样式
  imgEl.src = '';
  imgEl.alt = '缩略图不可用';
  imgEl.classList.add('files-grid-card-img--failed');
}

function switchViewMode(mode) {
  viewMode = mode === 'grid' ? 'grid' : 'list';
  const listWrap = document.getElementById('files-list-view');
  const gridWrap = document.getElementById('files-grid-view');
  const btnList = document.getElementById('view-mode-list');
  const btnGrid = document.getElementById('view-mode-grid');
  if (listWrap) listWrap.style.display = viewMode === 'list' ? '' : 'none';
  if (gridWrap) gridWrap.style.display = viewMode === 'grid' ? '' : 'none';
  if (btnList) btnList.classList.toggle('active', viewMode === 'list');
  if (btnGrid) btnGrid.classList.toggle('active', viewMode === 'grid');
  if (window.allFiles && window.allFiles.length > 0) {
    if (viewMode === 'grid') renderFilesGrid(window.allFiles);
    else renderFiles(window.allFiles);
  }
}

// 获取文件列表
function listFiles() {
  currentCategory = getCurrentCategory();
  if (!currentCategory) {
    showError('未指定分类');
    return Promise.reject(new Error('未指定分类'));
  }
  
  applyCategoryTheme();
  
  // 添加loading状态
  const tbody = document.querySelector('#file-table tbody');
  tbody.innerHTML = '<tr><td colspan="10" class="text-center">加载中...</td></tr>';
  
  // 构建API URL：未分组(空)传 ungroupedOnly=true，指定分组传 groupId，互斥
  let apiUrl = `${API_BASE}/categories/${currentCategory}/files?page=${currentPage - 1}&pageSize=${pageSize}`;
  if (currentGroupId) {
    apiUrl += `&groupId=${encodeURIComponent(currentGroupId)}`;
  } else {
    apiUrl += '&ungroupedOnly=true';
  }
  if (currentSearchKeyword.trim()) {
    apiUrl += `&keyword=${encodeURIComponent(currentSearchKeyword.trim())}`;
  }
  
  return fetch(apiUrl)
    .then(res => {
      if (!res.ok) throw new Error('获取文件列表失败');
      return res.json();
    })
    .then(data => {
      if (data && Array.isArray(data.files)) {
        totalFiles = data.total || 0;
        window.allFiles = data.files;
        if (viewMode === 'grid') renderFilesGrid(data.files);
        else renderFiles(data.files);
        clearSelectedRows();
        renderPagination({
          totalPages: Math.ceil(data.total / data.pageSize),
          number: data.page,
          first: data.page === 0,
          last: (data.page + 1) * data.pageSize >= data.total
        });
      } else {
        throw new Error('响应格式错误');
      }
    })
    .catch(e => {
      showError(e.message);
      throw e;
    });
}

// 渲染分页
function renderPagination(data) {
  if (!data) return;
  
  const {
    totalPages = 0,
    number: currentPageFromServer = 0,
    first = true,
    last = true
  } = data;
  
  // 更新当前页码（后端返回的页码从0开始，我们显示从1开始）
  currentPage = currentPageFromServer + 1;
  
  const pagination = document.getElementById('pagination');
  pagination.innerHTML = '';
  
  // 显示搜索信息
  if (currentSearchKeyword.trim()) {
    const searchInfo = document.createElement('div');
    searchInfo.className = 'text-center text-muted mb-2';
    searchInfo.innerHTML = `搜索"${currentSearchKeyword}"，共找到 ${totalFiles} 个文件`;
    pagination.appendChild(searchInfo);
  }
  
  if (totalPages <= 1) return;
  
  const ul = document.createElement('ul');
  ul.className = 'pagination justify-content-center';
  
  // 首页
  const firstLi = document.createElement('li');
  firstLi.className = `page-item ${first ? 'disabled' : ''}`;
  firstLi.innerHTML = `<a class="page-link" href="#" onclick="event.preventDefault(); ${first ? '' : 'changePage(1)'}">首页</a>`;
  ul.appendChild(firstLi);
  
  // 上一页
  const prevLi = document.createElement('li');
  prevLi.className = `page-item ${first ? 'disabled' : ''}`;
  prevLi.innerHTML = `<a class="page-link" href="#" onclick="event.preventDefault(); ${first ? '' : `changePage(${currentPage - 1})`}">上一页</a>`;
  ul.appendChild(prevLi);
  
  // 页码
  // 显示当前页码前后各2页
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);
  
  if (startPage > 1) {
    ul.appendChild(createPageItem('...', null, true));
  }
  
  for (let i = startPage; i <= endPage; i++) {
    const li = document.createElement('li');
    li.className = `page-item ${currentPage === i ? 'active' : ''}`;
    li.innerHTML = `<a class="page-link" href="#" onclick="event.preventDefault(); changePage(${i})">${i}</a>`;
    ul.appendChild(li);
  }
  
  if (endPage < totalPages) {
    ul.appendChild(createPageItem('...', null, true));
  }
  
  // 下一页
  const nextLi = document.createElement('li');
  nextLi.className = `page-item ${last ? 'disabled' : ''}`;
  nextLi.innerHTML = `<a class="page-link" href="#" onclick="event.preventDefault(); ${last ? '' : `changePage(${currentPage + 1})`}">下一页</a>`;
  ul.appendChild(nextLi);
  
  // 末页
  const lastLi = document.createElement('li');
  lastLi.className = `page-item ${last ? 'disabled' : ''}`;
  lastLi.innerHTML = `<a class="page-link" href="#" onclick="event.preventDefault(); ${last ? '' : `changePage(${totalPages})`}">末页</a>`;
  ul.appendChild(lastLi);
  
  pagination.appendChild(ul);
  
  // 添加页码信息
  const pageInfo = document.createElement('div');
  pageInfo.className = 'text-center mt-2';
  pageInfo.innerHTML = `第 ${currentPage} 页 / 共 ${totalPages} 页（共 ${totalFiles} 条记录）`;
  pagination.appendChild(pageInfo);
}

// 创建分页按钮
function createPageItem(text, page, disabled = false) {
  const li = document.createElement('li');
  li.className = `page-item ${disabled ? 'disabled' : ''}`;
  if (page) {
    li.innerHTML = `<a class="page-link" href="#" onclick="changePage(${page})">${text}</a>`;
  } else {
    li.innerHTML = `<span class="page-link">${text}</span>`;
  }
  return li;
}

// 切换页码
function changePage(page) {
  if (page < 1) return;
  currentPage = page;
  listFiles();
}

// 下载文件（异步下载任务）
function downloadFile(fileKey) {
  // 只要fileKey存在即可，不依赖文件对象
  if (!fileKey) {
    showError('未指定文件key');
    return;
  }
  const currentCategory = getCurrentCategory();
  if (!currentCategory) {
    showError('未指定分类');
    return;
  }
  const btn = getDownloadButtonByFileKey(fileKey);
  if (btn) {
    btn.disabled = true;
    btn.textContent = '下载准备中...';
  }
  fetch(`${API_BASE}/categories/${currentCategory}/files/download-task/${fileKey}`, { method: 'POST' })
    .then(res => {
      if (!res.ok) throw new Error('无法触发下载任务');
      showDownloadProgress('下载准备中...', fileKey);
      pollDownloadStatus(fileKey, btn);
    })
    .catch(e => {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '下载';
      }
      showDownloadProgress('', fileKey);
      showError(e.message);
    });
}

function pollDownloadStatus(fileKey, btn, tryCount = 0) {
  if (tryCount > 120) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '下载';
    }
    showDownloadProgress('', fileKey);
    showError('下载超时，请重试');
    return;
  }
  const currentCategory = getCurrentCategory();
  if (!currentCategory) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '下载';
    }
    showDownloadProgress('', fileKey);
    showError('未指定分类');
    return;
  }
  fetch(`${API_BASE}/categories/${currentCategory}/files/download-task-status/${fileKey}`)
    .then(res => {
      if (!res.ok) throw new Error('无法获取下载进度');
      return res.json();
    })
    .then(data => {
      if (data.status === 'success') {
        showDownloadProgress('下载成功', fileKey);
        if (btn) {
          btn.disabled = false;
          btn.textContent = '下载';
        }
        // 自动触发浏览器下载动作
        if (data.downloadUrl) {
          triggerBrowserDownload(data.downloadUrl, fileKey);
        }
        setTimeout(() => { listFiles(); }, 1000); // 下载成功后刷新文件列表
      } else if (data.status === 'failed') {
        if (btn) {
          btn.disabled = false;
          btn.textContent = '下载';
        }
        showDownloadProgress('下载失败', fileKey);
        showError('下载失败');
      } else if (data.status === 'downloading') {
        showDownloadProgress(`下载中... ${data.progress || 0}%`, fileKey);
        setTimeout(() => pollDownloadStatus(fileKey, btn, tryCount + 1), 3000);
      } else {
        showDownloadProgress('', fileKey);
        showError('未知下载状态');
        if (btn) {
          btn.disabled = false;
          btn.textContent = '下载';
        }
      }
    })
    .catch(() => setTimeout(() => pollDownloadStatus(fileKey, btn, tryCount + 1), 3000));
}

function toggleFileSelect(fileKey, checked) {
  if (!fileKey) return;
  if (checked) {
    selectedFileKeys.add(fileKey);
  } else {
    selectedFileKeys.delete(fileKey);
  }
}

function toggleSelectAll(checked) {
  const checkboxes = document.querySelectorAll('.file-select-checkbox');
  checkboxes.forEach(box => {
    box.checked = checked;
    if (checked) {
      selectedFileKeys.add(box.value);
    } else {
      selectedFileKeys.delete(box.value);
    }
  });
}

function clearSelectedRows() {
  selectedFileKeys.clear();
  const selectAll = document.getElementById('select-all-checkbox');
  if (selectAll) {
    selectAll.checked = false;
  }
}

// 点击行空白处时切换该行文件的选中状态（不响应按钮、链接、复选框等交互元素）
function handleFileRowClick(e) {
  const tr = e.target.closest('tr[data-filekey]');
  if (!tr) return;
  if (e.target.closest('button, a, input, select, [role="button"]')) return;
  const fileKey = tr.getAttribute('data-filekey');
  const checkbox = tr.querySelector('.file-select-checkbox');
  if (!checkbox) return;
  checkbox.checked = !checkbox.checked;
  toggleFileSelect(fileKey, checkbox.checked);
}

let assignModalInstance = null;

function openAssignModal() {
  if (!selectedFileKeys.size) {
    showInfo('请先勾选文件');
    return;
  }
  const currentCategory = getCurrentCategory();
  if (!currentCategory) {
    showError('未指定分类');
    return;
  }
  const countEl = document.getElementById('assign-selected-count');
  if (countEl) countEl.textContent = `已选 ${selectedFileKeys.size} 个文件`;
  const modalEl = document.getElementById('assignModal');
  if (!modalEl) return;
  if (!assignModalInstance) assignModalInstance = new bootstrap.Modal(modalEl);
  assignModalInstance.show();
}

function confirmAssignSelectedFiles() {
  const groupId = (document.getElementById('assign-group-select') || {}).value;
  const currentCategory = getCurrentCategory();
  if (!currentCategory) return showError('未指定分类');
  if (!groupId) return showError('请选择目标分组');
  if (!selectedFileKeys.size) return showInfo('请先勾选文件');
  const confirmBtn = document.getElementById('assign-confirm-btn');
  if (confirmBtn) confirmBtn.disabled = true;
  fetch(`${API_BASE}/categories/${currentCategory}/groups/${groupId}/files:assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileKeys: Array.from(selectedFileKeys), operator: 'ui' })
  })
    .then(res => {
      if (!res.ok) throw new Error('批量分配失败');
      showSuccess('批量分配成功');
      if (assignModalInstance) assignModalInstance.hide();
      clearSelectedRows();
      listFiles();
    })
    .catch(e => showError(e.message))
    .finally(() => {
      if (confirmBtn) confirmBtn.disabled = false;
    });
}

function assignSelectedFiles() {
  openAssignModal();
}

function triggerBrowserDownload(url, fileKey) {
  // 创建隐藏a标签自动下载
  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => document.body.removeChild(a), 100);
}

function getPreviewBlockedMessage(blockedReason) {
  switch (blockedReason) {
    case 'FROZEN':
      return '文件未解冻，暂不可预览';
    case 'TOO_LARGE':
      return '文件过大，暂不支持预览';
    case 'UNSUPPORTED_TYPE':
      return '当前文件类型不支持预览';
    case 'OSS_ONLY':
      return '仅远端存在，无解密信息不可预览';
    default:
      return '文件不可预览';
  }
}

function buildPreviewUrl(rawUrl) {
  if (!rawUrl) return '';
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return rawUrl;
  }
  return `${API_BASE}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
}

function inferMimeTypeFromFile(file) {
  if (file && file.mimeType) return file.mimeType;
  const fileName = file && file.fileName ? String(file.fileName).toLowerCase() : '';
  if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) return 'image/jpeg';
  if (fileName.endsWith('.png')) return 'image/png';
  if (fileName.endsWith('.gif')) return 'image/gif';
  if (fileName.endsWith('.webp')) return 'image/webp';
  if (fileName.endsWith('.pdf')) return 'application/pdf';
  if (fileName.endsWith('.txt') || fileName.endsWith('.log') || fileName.endsWith('.csv') || fileName.endsWith('.json') || fileName.endsWith('.xml')) return 'text/plain';
  return '';
}

function clearPreviewModalContent() {
  const container = document.getElementById('previewModalContent');
  if (container) {
    container.innerHTML = '';
  }
}

function ensurePreviewModalInit() {
  const modalEl = document.getElementById('previewModal');
  if (!modalEl || previewModalInstance) return;
  previewModalInstance = new bootstrap.Modal(modalEl);
  modalEl.addEventListener('hidden.bs.modal', () => {
    clearPreviewModalContent();
  });
}

function openPreviewModal(file) {
  ensurePreviewModalInit();
  const modalEl = document.getElementById('previewModal');
  const titleEl = document.getElementById('previewModalLabel');
  const contentEl = document.getElementById('previewModalContent');
  if (!modalEl || !titleEl || !contentEl || !previewModalInstance) {
    showError('预览弹窗初始化失败');
    return;
  }

  const previewUrl = buildPreviewUrl(file.previewUrl);
  const mimeType = inferMimeTypeFromFile(file);
  titleEl.innerHTML = `<i class="bi bi-eye text-primary"></i> 文件预览 - ${escapeHtml(file.fileName || file.fileKey || '')}`;

  if (mimeType.startsWith('image/')) {
    contentEl.innerHTML = `<img class="preview-image" src="${escapeHtmlAttr(previewUrl)}" alt="${escapeHtmlAttr(file.fileName || file.fileKey || 'preview-image')}">`;
  } else if (mimeType === 'application/pdf' || mimeType.startsWith('text/')) {
    contentEl.innerHTML = `<iframe class="preview-frame" src="${escapeHtmlAttr(previewUrl)}" title="${escapeHtmlAttr(file.fileName || file.fileKey || 'preview-frame')}"></iframe>`;
  } else {
    contentEl.innerHTML = `
      <div class="alert alert-warning mb-0">
        当前文件类型暂不支持弹窗预览，请下载后查看。
      </div>
    `;
  }

  previewModalInstance.show();
}

function previewFile(fileKey) {
  if (!fileKey) {
    showError('未指定文件key');
    return;
  }
  const file = getFileByKey(fileKey);
  if (!file) {
    showError('未找到文件信息，请先刷新列表');
    return;
  }
  if (!file.previewable || !file.previewUrl) {
    showWarning(getPreviewBlockedMessage(file.previewBlockedReason));
    return;
  }
  openPreviewModal(file);
}

// 下载进度展示（可自定义UI，这里简单用alert和console）
function showDownloadProgress(msg, fileKey) {
  const tbody = document.querySelector('#file-table tbody');
  let span = null;
  if (tbody) {
    for (const tr of tbody.querySelectorAll('tr[data-filekey]')) {
      if (tr.getAttribute('data-filekey') === fileKey) {
        span = tr.querySelector('.download-progress');
        break;
      }
    }
  }
  if (!span) return;
  span.textContent = msg;
  // 下载成功或失败时自动清空
  if (msg.includes('成功') || msg.includes('失败')) {
    setTimeout(() => { span.textContent = ''; }, 2000);
  }
}

// 删除文件
function deleteFile(fileKey) {
  showConfirm('确定要删除该文件吗？', () => {
    const currentCategory = getCurrentCategory();
    if (!currentCategory) {
      showError('未指定分类');
      return;
    }
    fetch(`${API_BASE}/categories/${currentCategory}/files/${fileKey}`, { method: 'DELETE' })
      .then(res => {
        if (!res.ok) throw new Error('删除文件失败');
        showSuccess('删除操作已提交');
        // 删除后刷新该文件的状态
        refreshSingleFile(fileKey);
      })
      .catch(e => showError(e.message));
  });
}



// 本地同步（改为确认删除）
function confirmDeleteFiles() {
  const confirmBtn = document.getElementById('sync-local-btn');
  const confirmIcon = confirmBtn.querySelector('.sync-icon');
  const currentCategory = getCurrentCategory();
  if (!currentCategory) {
    showError('未指定分类');
    return;
  }
  confirmBtn.disabled = true;
  confirmIcon.classList.add('spinning');
  fetch(`${API_BASE}/categories/${currentCategory}/files/confirm-delete`, {
    method: 'POST'
  })
    .then(res => {
      if (!res.ok) throw new Error('确认删除失败');
      showSuccess('确认删除成功');
      listFiles();
    })
    .catch(e => showError(e.message))
    .finally(() => {
      confirmBtn.disabled = false;
      confirmIcon.classList.remove('spinning');
    });
}

// 远程同步
function syncRemoteFiles() {
  const syncBtn = document.getElementById('sync-remote-btn');
  const syncIcon = syncBtn.querySelector('.sync-icon');
  const currentCategory = getCurrentCategory();
  if (!currentCategory) {
    showError('未指定分类');
    return;
  }
  syncBtn.disabled = true;
  syncIcon.classList.add('spinning');
  fetch(`${API_BASE}/categories/${currentCategory}/files/sync-remote`, {
    method: 'POST'
  })
    .then(res => {
      if (!res.ok) throw new Error('远程同步失败');
      return res.json();
    })
    .then(data => {
      // 展示统计信息
      if (typeof data.ossTotal !== 'undefined') {
        const message = `远程同步完成！<br>
          <strong>OSS总数:</strong> ${data.ossTotal}<br>
          <strong>OSS独有:</strong> ${data.ossOnly}<br>
          <strong>OSS与DB匹配:</strong> ${data.ossToDbMatched}<br>
          <strong>OSS与DB不匹配:</strong> ${data.ossToDbMismatched}<br>
          <strong>DB与OSS不匹配:</strong> ${data.dbToOssMismatched}`;
        showInfo(message);
      } else {
        showSuccess('远程同步成功');
      }
      listFiles();
    })
    .catch(e => showError(e.message))
    .finally(() => {
      syncBtn.disabled = false;
      syncIcon.classList.remove('spinning');
    });
}

// 解冻文件
function unfreezeFile(fileKey) {
  const row = getRowByFileKey(fileKey);
  const btn = row ? row.querySelector('.unfreeze-btn') : null;
  if (!btn) return;
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = '解冻中...';

  const currentCategory = getCurrentCategory();
  if (!currentCategory) {
    btn.disabled = false;
    btn.textContent = originalText;
    showError('未指定分类');
    return;
  }

  fetch(`${API_BASE}/categories/${currentCategory}/files/unfreeze/${fileKey}`, { method: 'POST' })
    .then(res => {
      if (res.status === 200) {
        // 解冻成功，直接更新按钮状态
        btn.textContent = '已解冻';
        btn.classList.remove('btn-warning');
        btn.classList.add('btn-success');
        btn.disabled = true; // 解冻成功后禁用按钮
        
        // 延迟刷新文件信息
        setTimeout(() => {
          refreshSingleFile(fileKey);
        }, 1000);
        
        showSuccess('文件解冻成功');
      } else if (res.status === 202) {
        // 解冻请求已接受，开始轮询状态
        pollUnfreezeStatus(fileKey, btn, originalText);
      } else {
        throw new Error(`解冻请求失败: ${res.status}`);
      }
    })
    .catch(e => {
      btn.disabled = false;
      btn.textContent = originalText;
      showError(e.message);
    });
}

function pollUnfreezeStatus(fileKey, btn, originalText, tryCount = 0) {
  // 最多轮询60次（约3分钟）
  if (tryCount > 60) {
    btn.disabled = false;
    btn.textContent = originalText;
    showError('解冻超时，请稍后重试');
    return;
  }
  
  const currentCategory = getCurrentCategory();
  if (!currentCategory) {
    btn.disabled = false;
    btn.textContent = originalText;
    showError('未指定分类');
    return;
  }
  
  fetch(`${API_BASE}/categories/${currentCategory}/files/unfreeze-status/${fileKey}`)
    .then(res => {
      if (res.status === 200) {
        // 解冻完成
        btn.textContent = '已解冻';
        btn.classList.remove('btn-warning');
        btn.classList.add('btn-success');
        btn.disabled = true; // 解冻成功后禁用按钮
        
        setTimeout(() => {
          // 刷新单个文件信息
          refreshSingleFile(fileKey);
        }, 1000);
        
        showSuccess('文件解冻完成');
      } else if (res.status === 202) {
        // 仍在解冻中，继续轮询
        setTimeout(() => pollUnfreezeStatus(fileKey, btn, originalText, tryCount + 1), 3000);
      } else {
        throw new Error(`查询解冻状态失败: ${res.status}`);
      }
    })
    .catch(e => {
      // 网络错误或其他错误，继续轮询
      setTimeout(() => pollUnfreezeStatus(fileKey, btn, originalText, tryCount + 1), 3000);
    });
}



// 复制本地路径到剪贴板
function copyLocalPath(path) {
  navigator.clipboard.writeText(path).then(() => {
    showSuccess('已复制本地路径');
  });
}

// 获取当前文件对象
function getFileByKey(fileKey) {
  // 由于文件列表是动态渲染的，这里通过页面上的tbody查找
  // 你可以根据实际数据结构优化此方法
  const tbody = document.querySelector('#file-table tbody');
  if (!tbody) return null;
  for (const tr of tbody.children) {
    const keyCell = tr.querySelector('.filekey-cell');
    if (keyCell && keyCell.textContent === fileKey) {
      // 通过tr.dataset或其他方式存储file对象更好，这里简单返回null
      // 实际项目建议将文件数据缓存到全局变量
      return null;
    }
  }
  // 推荐：将文件数据缓存到全局变量allFiles，在listFiles时赋值
  if (window.allFiles) {
    return window.allFiles.find(f => f.fileKey === fileKey);
  }
  return null;
}

// 新增：处理本地文件不存在时的重新下载逻辑
function handleLocalPathMissingDownload(fileKeyOrEl) {
  const fileKey = (fileKeyOrEl && typeof fileKeyOrEl.getAttribute === 'function')
    ? fileKeyOrEl.getAttribute('data-filekey') : fileKeyOrEl;
  if (!fileKey) return;
  showConfirm('本地文件不存在，是否重新下载？', () => {
    const tbody = document.querySelector('#file-table tbody');
    let btn = null;
    if (tbody) {
      for (const tr of tbody.querySelectorAll('tr[data-filekey]')) {
        if (tr.getAttribute('data-filekey') === fileKey) {
          btn = tr.querySelector('.download-btn');
          break;
        }
      }
    }
    if (btn) {
      btn.disabled = false;
      btn.removeAttribute('title');
      downloadFile(fileKey);
    }
  });
}

// 新增：释放本地文件
function releaseLocalFile(fileKey, localPath) {
  showConfirm('确定要释放本地文件吗？此操作会删除本地副本，但不会影响云端文件。', () => {
    const currentCategory = getCurrentCategory();
    if (!currentCategory) {
      showError('未指定分类');
      return;
    }
    fetch(`${API_BASE}/categories/${currentCategory}/files/release-local/${fileKey}`, { method: 'POST' })
      .then(res => {
        if (!res.ok) throw new Error('释放本地文件失败');
        showSuccess('本地文件已释放');
        // 刷新单个文件信息
        refreshSingleFile(fileKey);
      })
      .catch(e => showError(e.message));
  });
}

// 新增：上传相关函数
let uploadAreaInitialized = false;

function openUploadModal() {
  const modal = new bootstrap.Modal(document.getElementById('uploadModal'));
  modal.show();
  setupUploadArea();
}

function setupUploadArea() {
  if (uploadAreaInitialized) {
    return;
  }
  const uploadArea = document.getElementById('uploadArea');
  const fileInput = document.getElementById('fileInput');
  
  // 点击上传区域触发文件选择
  uploadArea.addEventListener('click', () => {
    fileInput.click();
  });
  
  // 文件选择事件
  fileInput.addEventListener('change', handleFileSelect);
  
  // 拖拽事件
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });
  
  uploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
  });
  
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      fileInput.files = transfer.files;
      handleFileSelect();
    }
  });

  uploadAreaInitialized = true;
}

function handleFileSelect() {
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files && fileInput.files[0];
  const fileInfo = document.getElementById('fileInfo');
  const fileName = document.getElementById('fileName');
  const fileSize = document.getElementById('fileSize');
  const uploadBtn = document.getElementById('uploadBtn');

  if (file) {
    fileName.textContent = file.name;
    fileSize.textContent = formatSize(file.size);
    fileInfo.style.display = 'block';
    uploadBtn.disabled = false;
  } else {
    fileInfo.style.display = 'none';
    uploadBtn.disabled = true;
  }
}

function clearFileSelection() {
  const fileInput = document.getElementById('fileInput');
  const fileInfo = document.getElementById('fileInfo');
  const uploadBtn = document.getElementById('uploadBtn');
  
  fileInput.value = '';
  fileInfo.style.display = 'none';
  uploadBtn.disabled = true;
}

function uploadFile() {
  const fileInput = document.getElementById('fileInput');
  const uploadBtn = document.getElementById('uploadBtn');
  const uploadProgress = document.getElementById('uploadProgress');
  const progressBar = uploadProgress.querySelector('.progress-bar');
  const uploadStatus = document.getElementById('uploadStatus');
  const currentCategory = getCurrentCategory();

  const file = fileInput.files && fileInput.files[0];
  if (!file) {
    showError('请选择要上传的文件');
    return;
  }
  if (!currentCategory) {
    showError('未指定分类');
    return;
  }

  uploadProgress.style.display = 'block';
  uploadBtn.disabled = true;
  progressBar.style.width = '0%';
  uploadStatus.textContent = `准备上传 ${file.name}...`;

  function parseUploadError(xhr) {
    try {
      const body = JSON.parse(xhr.responseText);
      if (body && body.error) return body.error;
    } catch (_) {}
    switch (xhr.status) {
      case 400: return '文件格式不支持或文件过大';
      case 409: return '同名文件正在上传，请稍后重试';
      case 413: return '文件大小超限';
      default: return '上传失败';
    }
  }

  const formData = new FormData();
  formData.append('file', file);
  const xhr = new XMLHttpRequest();

  xhr.upload.addEventListener('progress', (e) => {
    if (!e.lengthComputable) {
      uploadStatus.textContent = `上传中... ${formatSize(e.loaded)}`;
      return;
    }
    const pct = Math.min(99, Math.round((e.loaded / e.total) * 100));
    progressBar.style.width = pct + '%';
    uploadStatus.textContent = `上传中... ${pct}%（${formatSize(e.loaded)} / ${formatSize(e.total)}）`;
  });

  xhr.upload.addEventListener('load', () => {
    progressBar.style.width = '99%';
    uploadStatus.textContent = '文件已发送到后端，正在加密并完成 OSS 分片上传...';
  });

  xhr.addEventListener('load', () => {
    uploadBtn.disabled = false;
    if (xhr.status === 200) {
      progressBar.style.width = '100%';
      uploadStatus.textContent = '上传完成';
      showSuccess('文件上传成功');
      try {
        const response = JSON.parse(xhr.responseText);
        if (response.fileKey) {
          fetch(`${API_BASE}/categories/${currentCategory}/files/${response.fileKey}`)
            .then(res => res.ok ? res.json() : Promise.reject(new Error('获取文件信息失败')))
            .then(fileData => addNewFileToTop(fileData))
            .catch(e => console.error('获取文件信息失败:', e));
        }
      } catch (_) {}
      clearFileSelection();
      const modal = bootstrap.Modal.getInstance(document.getElementById('uploadModal'));
      if (modal) modal.hide();
      uploadProgress.style.display = 'none';
      listFiles();
      return;
    }

    showError(`${file.name}: ${parseUploadError(xhr)}`);
  });

  xhr.addEventListener('error', () => {
    uploadBtn.disabled = false;
    showError(`${file.name}: 网络错误`);
  });

  xhr.addEventListener('abort', () => {
    uploadBtn.disabled = false;
    showError('上传已取消');
  });

  xhr.open('POST', `${API_BASE}/categories/${currentCategory}/files/upload`);
  xhr.send(formData);
}

// 搜索相关函数
function performSearch() {
  const searchInput = document.getElementById('searchInput');
  const keyword = searchInput.value.trim();
  
  if (keyword === currentSearchKeyword) {
    return; // 关键词没有变化，不需要重新搜索
  }
  
  currentSearchKeyword = keyword;
  currentPage = 1; // 搜索时重置到第一页
  
  // 更新清除按钮显示状态
  updateClearSearchButton();
  
  // 执行搜索
  listFiles();
}

function clearSearch() {
  const searchInput = document.getElementById('searchInput');
  searchInput.value = '';
  currentSearchKeyword = '';
  currentPage = 1; // 清除搜索时重置到第一页
  
  // 更新清除按钮显示状态
  updateClearSearchButton();
  
  // 重新加载文件列表
  listFiles();
}

function handleSearchKeyPress(event) {
  if (event.key === 'Enter') {
    performSearch();
  }
}

function updateClearSearchButton() {
  const clearBtn = document.getElementById('clearSearchBtn');
  if (clearBtn) {
    clearBtn.style.display = currentSearchKeyword.trim() ? 'block' : 'none';
  }
}

// 刷新文件列表（带动画效果）
function refreshFileList() {
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.classList.add('spinning');
  }
  
  listFiles().finally(() => {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.classList.remove('spinning');
    }
  });
}

window.toggleExpandDetail = toggleExpandDetail;
window.backToCategories = backToCategories;
window.listFiles = listFiles;
window.refreshFileList = refreshFileList; // 新增：暴露带动画的刷新函数
window.performSearch = performSearch; // 新增：暴露搜索函数
window.clearSearch = clearSearch; // 新增：暴露清除搜索函数
window.handleSearchKeyPress = handleSearchKeyPress; // 新增：暴露搜索按键处理函数
window.downloadFile = downloadFile;
window.previewFile = previewFile;
window.deleteFile = deleteFile;
window.changePage = changePage;
window.confirmDeleteFiles = confirmDeleteFiles;
window.syncRemoteFiles = syncRemoteFiles;
window.unfreezeFile = unfreezeFile;
window.copyLocalPath = copyLocalPath;
window.handleLocalPathMissingDownload = handleLocalPathMissingDownload;
window.releaseLocalFile = releaseLocalFile;
window.refreshSingleFile = refreshSingleFile; // 新增：暴露刷新函数
window.updateFileRow = updateFileRow; // 新增：暴露更新函数
window.addNewFileToTop = addNewFileToTop; // 新增：暴露添加新文件函数
window.generateFileRowHTML = generateFileRowHTML; // 新增：暴露生成HTML函数
window.openUploadModal = openUploadModal; // 新增：暴露上传模态框函数
window.clearFileSelection = clearFileSelection; // 新增：暴露清除文件选择函数
window.uploadFile = uploadFile; // 新增：暴露上传文件函数
window.changeGroupFilter = changeGroupFilter;
window.toggleFileSelect = toggleFileSelect;
window.toggleSelectAll = toggleSelectAll;
window.assignSelectedFiles = assignSelectedFiles;
window.confirmAssignSelectedFiles = confirmAssignSelectedFiles;
window.switchViewMode = switchViewMode;
window.handleGridThumbError = handleGridThumbError;

window.onload = () => {
  ensurePreviewModalInit();
  switchViewMode(viewMode);
  const tbody = document.querySelector('#file-table tbody');
  if (tbody) tbody.addEventListener('click', handleFileRowClick);
  loadCategoryMetaAndGroups().finally(() => listFiles());
};
