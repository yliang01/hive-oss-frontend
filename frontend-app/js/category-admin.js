import '../css/style.css';
import { showError, showSuccess, showInfo } from './utils.js';

const API_BASE = 'http://localhost:8080';
let selectedCategoryCode = '';

function renderCategories(categories) {
  const body = document.getElementById('category-table-body');
  body.innerHTML = '';
  (categories || []).forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.code}</td>
      <td>${item.name}</td>
      <td>${item.storageClass || '-'}</td>
      <td>${item.enabled ? '是' : '否'}</td>
      <td>${item.sortOrder ?? '-'}</td>
      <td>
        <button class="btn btn-sm btn-ui-compact btn-outline-primary me-1" onclick="selectCategory('${item.code}')">分组</button>
        <button class="btn btn-sm btn-ui-compact btn-outline-secondary me-1" onclick="editCategory('${item.code}')">编辑</button>
        <button class="btn btn-sm btn-ui-compact btn-outline-warning me-1" onclick="disableCategory('${item.code}')">停用</button>
        <button class="btn btn-sm btn-ui-compact btn-outline-danger" onclick="deleteCategory('${item.code}')">删除</button>
      </td>
    `;
    body.appendChild(tr);
  });
}

function renderGroups(groups) {
  const body = document.getElementById('group-table-body');
  body.innerHTML = '';
  (groups || []).forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.groupCode}</td>
      <td>${item.groupName}</td>
      <td>${item.enabled ? '是' : '否'}</td>
      <td>${item.sortOrder ?? '-'}</td>
      <td>
        <button class="btn btn-sm btn-ui-compact btn-outline-secondary me-1" onclick="editGroup(${item.groupId})">编辑</button>
        <button class="btn btn-sm btn-ui-compact btn-outline-danger" onclick="deleteGroup(${item.groupId})">删除</button>
      </td>
    `;
    body.appendChild(tr);
  });
}

function loadCategories() {
  return fetch(`${API_BASE}/category-admin/categories`)
    .then(res => {
      if (!res.ok) throw new Error('加载分类失败');
      return res.json();
    })
    .then(renderCategories)
    .catch(e => showError(e.message));
}

function loadGroups() {
  if (!selectedCategoryCode) {
    renderGroups([]);
    return;
  }
  fetch(`${API_BASE}/category-admin/categories/${selectedCategoryCode}/groups`)
    .then(res => {
      if (!res.ok) throw new Error('加载分组失败');
      return res.json();
    })
    .then(renderGroups)
    .catch(e => showError(e.message));
}

function selectCategory(code) {
  selectedCategoryCode = code;
  document.getElementById('current-category-label').textContent = code;
  loadGroups();
}

function createCategory() {
  const code = window.prompt('分类编码（建议大写下划线）');
  const name = window.prompt('分类名称');
  const storageClass = window.prompt('存储层（STANDARD/ARCHIVE）', 'STANDARD');
  if (!code || !name) return;
  fetch(`${API_BASE}/category-admin/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, name, storageClass, enabled: true, sortOrder: 100, uiVariant: 'hot' })
  })
    .then(res => {
      if (!res.ok) throw new Error('创建分类失败');
      return res.json();
    })
    .then(() => {
      showSuccess('创建成功');
      loadCategories();
    })
    .catch(e => showError(e.message));
}

function editCategory(code) {
  const name = window.prompt('新的分类名称');
  const storageClass = window.prompt('存储层（STANDARD/ARCHIVE）', 'STANDARD');
  if (!name) return;
  fetch(`${API_BASE}/category-admin/categories/${code}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, storageClass })
  })
    .then(res => {
      if (!res.ok) throw new Error('更新分类失败');
      return res.json();
    })
    .then(() => {
      showSuccess('更新成功');
      loadCategories();
    })
    .catch(e => showError(e.message));
}

function disableCategory(code) {
  fetch(`${API_BASE}/category-admin/categories/${code}/disable`, { method: 'POST' })
    .then(res => {
      if (!res.ok) throw new Error('停用分类失败');
      showInfo('已停用');
      loadCategories();
    })
    .catch(e => showError(e.message));
}

function deleteCategory(code) {
  if (!window.confirm(`确认删除分类 ${code}？删除前请确保该分类没有分组和文件。`)) {
    return;
  }
  fetch(`${API_BASE}/category-admin/categories/${code}`, { method: 'DELETE' })
    .then(res => {
      if (!res.ok) throw new Error('删除分类失败：该分类可能仍有分组或文件');
      showSuccess('删除成功');
      if (selectedCategoryCode === code) {
        selectedCategoryCode = '';
        document.getElementById('current-category-label').textContent = '未选择';
        renderGroups([]);
      }
      loadCategories();
    })
    .catch(e => showError(e.message));
}

function createGroup() {
  if (!selectedCategoryCode) return showInfo('请先选择分类');
  const groupCode = window.prompt('分组编码');
  const groupName = window.prompt('分组名称');
  if (!groupCode || !groupName) return;
  fetch(`${API_BASE}/category-admin/categories/${selectedCategoryCode}/groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupCode, groupName, sortOrder: 100, enabled: true })
  })
    .then(res => {
      if (!res.ok) throw new Error('创建分组失败');
      return res.json();
    })
    .then(() => {
      showSuccess('创建分组成功');
      loadGroups();
    })
    .catch(e => showError(e.message));
}

function editGroup(groupId) {
  if (!selectedCategoryCode) return showInfo('请先选择分类');
  const groupName = window.prompt('新的分组名称');
  if (!groupName) return;
  fetch(`${API_BASE}/category-admin/categories/${selectedCategoryCode}/groups/${groupId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupName })
  })
    .then(res => {
      if (!res.ok) throw new Error('更新分组失败');
      return res.json();
    })
    .then(() => {
      showSuccess('更新分组成功');
      loadGroups();
    })
    .catch(e => showError(e.message));
}

function deleteGroup(groupId) {
  if (!selectedCategoryCode) return showInfo('请先选择分类');
  fetch(`${API_BASE}/category-admin/categories/${selectedCategoryCode}/groups/${groupId}`, { method: 'DELETE' })
    .then(res => {
      if (!res.ok) throw new Error('删除分组失败（可能仍关联文件）');
      showSuccess('删除分组成功');
      loadGroups();
    })
    .catch(e => showError(e.message));
}

function backHome() {
  window.location.href = window.location.origin + '/';
}

window.loadCategories = loadCategories;
window.selectCategory = selectCategory;
window.createCategory = createCategory;
window.editCategory = editCategory;
window.disableCategory = disableCategory;
window.deleteCategory = deleteCategory;
window.createGroup = createGroup;
window.editGroup = editGroup;
window.deleteGroup = deleteGroup;
window.backHome = backHome;

window.onload = () => loadCategories();
