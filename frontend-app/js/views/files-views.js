/**
 * 文件管理页展示层：文件表格行、展开详情、列表与分页的 DOM/HTML 构建。
 * 逻辑与 API 调用保留在 files.js。
 */

import { formatSize, formatDate } from '../utils.js';

const FILE_KEY_PREFIX_LEN = 18;
const FILE_KEY_SUFFIX_LEN = 22;
const FILE_NAME_MAX_LEN = 50;

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

function formatFileNameForList(fileName) {
  if (fileName == null) fileName = '';
  const s = String(fileName);
  const len = s.length;
  let display = s;
  if (s.length > FILE_NAME_MAX_LEN) {
    display = '...' + s.slice(-(FILE_NAME_MAX_LEN - 3));
  }
  return { display, len, badge: len > FILE_NAME_MAX_LEN ? len + 'c' : null };
}

function formatFileKeyForList(fileKey) {
  if (fileKey == null) fileKey = '';
  const s = String(fileKey);
  const len = s.length;
  const needEllipsis = len > FILE_KEY_PREFIX_LEN + FILE_KEY_SUFFIX_LEN;
  let display = s;
  if (needEllipsis) {
    display = s.slice(0, FILE_KEY_PREFIX_LEN) + '...' + s.slice(-FILE_KEY_SUFFIX_LEN);
  }
  return { display, len, badge: len > FILE_KEY_PREFIX_LEN + FILE_KEY_SUFFIX_LEN ? len + 'c' : null };
}

function highlightSearch(text, keyword) {
  if (text == null) text = '';
  if (!keyword || !String(keyword).trim()) return escapeHtml(text);
  const escaped = escapeHtml(text);
  const k = String(keyword).trim();
  const re = new RegExp('(' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
  return escaped.replace(re, '<span class="search-highlight">$1</span>');
}

function getPreviewBlockedMessage(blockedReason) {
  switch (blockedReason) {
    case 'FROZEN':
      return '文件未解冻，暂不可预览';
    case 'TOO_LARGE':
      return '文件过大，暂不支持预览';
    case 'UNSUPPORTED_TYPE':
      return '当前文件类型不支持预览';
    default:
      return '文件不可预览';
  }
}

function buildPreviewButton(file, keyEsc) {
  if (file.previewable && file.previewUrl) {
    return `<button class="btn btn-sm btn-outline-primary preview-btn" onclick="previewFile('${keyEsc}')" title="在线预览">预览</button>`;
  }
  const title = escapeHtmlAttr(getPreviewBlockedMessage(file.previewBlockedReason));
  return `<button class="btn btn-sm btn-outline-primary preview-btn" disabled title="${title}">预览</button>`;
}

/**
 * 生成单行文件表格 HTML。currentSearchKeyword 用于搜索高亮。
 */
export function generateFileRowHTML(file, currentSearchKeyword) {
  const kw = (currentSearchKeyword || '').trim();
  const keyEsc = escapeJsString(file.fileKey);
  const keyAttr = escapeHtmlAttr(file.fileKey);
  const fn = formatFileNameForList(file.fileName);
  const fk = formatFileKeyForList(file.fileKey);
  const nameDisplay = highlightSearch(fn.display, kw);
  const keyDisplay = highlightSearch(fk.display, kw);
  const nameBadge = fn.badge ? `<span class="key-badge">${escapeHtml(fn.badge)}</span>` : '';
  const keyBadge = fk.badge ? `<span class="key-badge">${escapeHtml(fk.badge)}</span>` : '';
  const titleName = escapeHtmlAttr(file.fileName);
  const titleKey = escapeHtmlAttr(file.fileKey);
  const localPathEsc = file.localPath ? escapeJsString(file.localPath) : '';
  const localPathAttr = file.localPath ? escapeHtmlAttr(file.localPath) : '';
  return `
    <td class="filename-cell" title="${titleName}" aria-label="${titleName}">
      <div class="file-value-compact">
        <span class="text-ellipsis">${nameDisplay}</span>${nameBadge}
        <button type="button" class="btn btn-link btn-sm p-0 ms-1 text-secondary" onclick="toggleExpandDetail('${keyEsc}')" title="查看完整" aria-label="查看完整文件名与 Key">
          <i class="bi bi-eye"></i>
        </button>
      </div>
    </td>
    <td class="filekey-cell" title="${titleKey}" aria-label="${titleKey}">
      <div class="file-value-compact">
        <span class="text-ellipsis">${keyDisplay}</span>${keyBadge}
      </div>
      <button type="button" class="btn btn-sm btn-outline-secondary key-cell-mobile-btn" onclick="toggleExpandDetail('${keyEsc}')" aria-label="Key 详情">
        <i class="bi bi-info-circle"></i> Key详情
      </button>
    </td>
    <td>${file.zipped ? '是' : '否'}</td>
    <td>${formatSize(file.size)}</td>
    <td>${file.status}</td>
    <td>${formatDate(file.updateTime)}</td>
    <td>${file.unfreezeTime ? formatDate(file.unfreezeTime) : '-'}</td>
    <td class="file-actions-cell">
      <div class="file-actions-row d-flex flex-row align-items-center gap-2">
        <button class="btn btn-sm btn-warning unfreeze-btn" onclick="unfreezeFile('${keyEsc}')" ${!file.restorable ? 'disabled' : ''} title="${file.restorable ? '解冻文件' : '该文件不可解冻'}">解冻</button>
        <button class="btn btn-sm btn-primary download-btn" data-filekey="${keyAttr}" onclick="downloadFile('${keyEsc}')" ${file.downloadable === false ? 'disabled title=\'该文件不可下载\'' : ''}>下载</button>
        ${buildPreviewButton(file, keyEsc)}
        <button class="btn btn-sm btn-danger" onclick="deleteFile('${keyEsc}')" ${!file.deletable ? 'disabled' : ''} title="${file.deletable ? '删除文件' : '该文件不可删除'}">删除</button>
      </div>
      <div class="file-actions-row d-flex flex-row align-items-center gap-2">
        ${file.localPath ? `<button class='btn btn-outline-secondary btn-sm' onclick='copyLocalPath("${escapeJsString(file.localPath)}")' title='复制本地路径'>复制路径</button>` : ''}
        ${file.localPath ? `<button class='btn btn-outline-danger btn-sm' onclick='releaseLocalFile("${keyEsc}", "${localPathEsc}")' title='释放本地文件'>释放本地</button>` : ''}
        ${file.localPath ? `<span class="ms-1" title="${file.localPathExists === undefined ? '未知' : (file.localPathExists ? '本地文件存在' : '本地文件不存在')}">
          ${file.localPathExists === undefined ? '' : (file.localPathExists ? '<span style=\'color:green;font-size:1.2em;\'>&#10003;</span>' : `<span style='color:red;font-size:1.2em;cursor:pointer;' data-filekey='${keyAttr}' onclick='handleLocalPathMissingDownload(this)'>&#10007;</span>`)}
        </span>` : ''}
        <span class="download-progress text-info small" data-filekey="${keyAttr}"></span>
      </div>
    </td>
  `;
}

/**
 * 生成展开详情面板 HTML。
 */
export function buildExpandedDetailRow(file, currentSearchKeyword) {
  const fileName = file.fileName != null ? String(file.fileName) : '';
  const fileKey = file.fileKey != null ? String(file.fileKey) : '';
  const kw = (currentSearchKeyword || '').trim();
  const nameHtml = highlightSearch(fileName, kw);
  const keyHtml = highlightSearch(fileKey, kw);
  const nameAttr = escapeHtmlAttr(fileName);
  const keyAttr = escapeHtmlAttr(fileKey);
  return `
    <div class="row-expand-content" data-file-name="${nameAttr}" data-file-key="${keyAttr}">
      <div class="row-expand-item">
        <label>文件名</label>
        <div class="file-value-expanded" aria-label="${nameAttr}">${nameHtml}</div>
        <div class="copy-buttons mt-1">
          <button type="button" class="btn btn-sm btn-outline-secondary copy-file-name-btn">复制文件名</button>
        </div>
      </div>
      <div class="row-expand-item">
        <label>Key</label>
        <div class="file-value-expanded" aria-label="${keyAttr}">${keyHtml}</div>
        <div class="copy-buttons mt-1">
          <button type="button" class="btn btn-sm btn-outline-secondary copy-file-key-btn">复制 Key</button>
        </div>
      </div>
    </div>
  `;
}
