<template>
  <div class="admin-page ops-page">
    <div class="admin-container ops-container">
      <header class="ops-hero">
        <div>
          <el-button class="back-button" text @click="router.push('/')">
            <el-icon><ArrowLeft /></el-icon>返回控制台
          </el-button>
          <div class="ops-kicker">Resource Taxonomy</div>
          <h1 class="ops-title">分类与分组管理</h1>
        </div>
        <div class="hero-actions">
          <el-button :loading="catLoading" @click="loadCategories">
            <el-icon><Refresh /></el-icon>刷新
          </el-button>
        </div>
      </header>

      <el-row :gutter="24">
        <el-col :xs="24" :lg="12">
          <el-card class="admin-card" shadow="never">
            <template #header>
              <div class="card-header-row">
                <div class="card-title-stack">
                  <div class="ops-card-title">
                    <span class="ops-icon-box"><el-icon><Grid /></el-icon></span>
                    <span>分类列表</span>
                  </div>
                  <div class="card-title-meta">共 {{ categories.length }} 项</div>
                </div>
                <div class="category-header-actions">
                  <el-button type="primary" size="small" @click="openCategoryDialog()">新增分类</el-button>
                </div>
              </div>
            </template>
            <el-table class="category-table" :data="categories" v-loading="catLoading" size="small" style="width: 100%" :row-class-name="categoryRowClass" @row-click="row => selectCategory(row.code)">
              <el-table-column prop="name" label="名称" min-width="140" show-overflow-tooltip />
              <el-table-column prop="storageClass" label="存储层" width="92" />
              <el-table-column label="视图" width="76">
                <template #default="{ row }">
                  <el-tag size="small" effect="plain">{{ variantLabel(row.uiVariant) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="启用" width="68" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '是' : '否' }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="104" fixed="right">
                <template #default="{ row }">
                  <div class="category-actions" @click.stop>
                    <el-button link size="small" @click="openCategoryDialog(row)">编辑</el-button>
                    <el-dropdown trigger="click" @command="cmd => handleCategoryCommand(cmd, row)">
                      <el-button link size="small">更多</el-button>
                      <template #dropdown>
                        <el-dropdown-menu>
                          <el-dropdown-item :command="row.enabled ? 'disable' : 'enable'">
                            {{ row.enabled ? '停用' : '启用' }}
                          </el-dropdown-item>
                          <el-dropdown-item command="delete" divided class="danger-dropdown-item">删除</el-dropdown-item>
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>

        <el-col :xs="24" :lg="12">
          <el-card class="admin-card" shadow="never">
            <template #header>
              <div class="card-header-row">
                <div class="card-title-stack">
                  <div class="ops-card-title">
                    <span class="ops-icon-box"><el-icon><Connection /></el-icon></span>
                    <span>分组列表</span>
                  </div>
                  <div v-if="selectedCategory" class="card-title-meta">
                    <strong>{{ selectedCategory.name }}</strong>
                  </div>
                  <div v-else class="card-title-meta">选择分类后管理分组</div>
                </div>
                <div class="group-header-actions">
                  <el-tag v-if="selectedCategory" size="small" :type="selectedCategory.enabled ? 'success' : 'info'" effect="plain">
                    {{ selectedCategory.enabled ? '启用' : '停用' }}
                  </el-tag>
                  <span v-else class="text-muted small">请先选择分类</span>
                  <el-button type="primary" size="small" :disabled="!selectedCat" @click="openGroupDialog()">新增分组</el-button>
                </div>
              </div>
            </template>
            <el-empty v-if="!selectedCat" description="请先从左侧选择分类" :image-size="72" />
            <el-table v-else :data="groups" v-loading="groupLoading" size="small" stripe style="width: 100%" empty-text="暂无分组">
              <el-table-column prop="groupName" label="名称" min-width="150" show-overflow-tooltip />
              <el-table-column prop="sortOrder" label="排序" width="72" align="center" />
              <el-table-column label="操作" width="104" fixed="right">
                <template #default="{ row }">
                  <div class="group-actions">
                    <el-button link size="small" @click="openGroupDialog(row)">编辑</el-button>
                    <el-button link size="small" type="danger" @click="deleteGroup(row.groupCode)">删除</el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 分类编辑 Dialog -->
    <el-dialog v-model="catDialogVisible" :title="editingCategory ? '编辑分类' : '新增分类'" width="460px">
      <el-form :model="catForm" label-width="80px" @submit.prevent>
        <el-form-item label="编码" required>
          <el-input v-model="catForm.code" :disabled="!!editingCategory" placeholder="建议大写+下划线，如 PHOTOS" />
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="catForm.name" placeholder="显示名称" />
        </el-form-item>
        <el-form-item label="Bucket" required>
          <el-input v-model="catForm.bucketName" :disabled="!!editingCategory" placeholder="OSS bucket 名称（创建后不可修改）" />
        </el-form-item>
        <el-form-item label="存储层">
          <el-select v-model="catForm.storageClass" style="width:100%">
            <el-option label="STANDARD（标准）" value="STANDARD" />
            <el-option label="ARCHIVE（归档）" value="ARCHIVE" />
          </el-select>
        </el-form-item>
        <el-form-item label="UI 变体">
          <el-select v-model="catForm.uiVariant" style="width:100%">
            <el-option label="file（文件）" value="file" />
            <el-option label="image（图片）" value="image" />
            <el-option label="archive（归档）" value="archive" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="catForm.sortOrder" :min="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="catDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="catSaving" @click="saveCategory">保存</el-button>
      </template>
    </el-dialog>

    <!-- 分组编辑 Dialog -->
    <el-dialog v-model="groupDialogVisible" :title="editingGroup ? '编辑分组' : '新增分组'" width="420px">
      <el-form :model="groupForm" label-width="80px" @submit.prevent>
        <el-form-item label="编码" required>
          <el-input v-model="groupForm.groupCode" :disabled="!!editingGroup" placeholder="分组编码" />
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="groupForm.groupName" placeholder="分组名称" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="groupForm.sortOrder" :min="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="groupDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="groupSaving" @click="saveGroup">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as catApi from '@/api/categories'
import type { Category, Group } from '@/types'

const router = useRouter()
const route = useRoute()

const categories = ref<Category[]>([])
const catLoading = ref(false)
const groups = ref<Group[]>([])
const groupLoading = ref(false)
const selectedCat = ref('')

const selectedCategory = computed(() => categories.value.find(c => c.code === selectedCat.value) || null)

type CategoryForm = Pick<Category, 'code' | 'name' | 'bucketName' | 'storageClass' | 'uiVariant' | 'sortOrder' | 'enabled'>
type GroupForm = Pick<Group, 'groupCode' | 'groupName' | 'sortOrder'>

// Category dialog
const catDialogVisible = ref(false)
const catSaving = ref(false)
const editingCategory = ref<Category | null>(null)
const catForm = ref<CategoryForm>({ code: '', name: '', bucketName: '', storageClass: 'STANDARD', uiVariant: 'file', sortOrder: 100, enabled: true })

// Group dialog
const groupDialogVisible = ref(false)
const groupSaving = ref(false)
const editingGroup = ref<Group | null>(null)
const groupForm = ref<GroupForm>({ groupCode: '', groupName: '', sortOrder: 100 })

async function loadCategories() {
  catLoading.value = true
  try {
    const res = await catApi.adminGetCategories()
    categories.value = res.data || []
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error ?? '加载分类失败')
  } finally {
    catLoading.value = false
  }
}

async function applyRouteIntent() {
  const category = typeof route.query.category === 'string' ? route.query.category : ''
  if (!category) return
  const exists = categories.value.some(c => c.code === category)
  if (!exists) {
    ElMessage.warning('指定分类不存在')
    return
  }
  selectedCat.value = category
  await loadGroups()
  if (route.query.action === 'new-group') {
    openGroupDialog()
  }
}

async function loadGroups() {
  if (!selectedCat.value) { groups.value = []; return }
  groupLoading.value = true
  try {
    const res = await catApi.adminGetGroups(selectedCat.value)
    groups.value = res.data || []
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error ?? '加载分组失败')
  } finally {
    groupLoading.value = false
  }
}

function selectCategory(code: string) {
  selectedCat.value = code
  loadGroups()
}

function categoryRowClass({ row }: { row: Category }) {
  return row.code === selectedCat.value ? 'selected-category-row' : ''
}

function variantLabel(variant: string | undefined) {
  if (variant === 'image') return '图片'
  if (variant === 'archive') return '归档'
  return '文件'
}

function openCategoryDialog(cat?: Category) {
  editingCategory.value = cat || null
  if (cat) {
    catForm.value = { code: cat.code, name: cat.name, bucketName: cat.bucketName, storageClass: cat.storageClass, uiVariant: cat.uiVariant, sortOrder: cat.sortOrder, enabled: cat.enabled }
  } else {
    catForm.value = { code: '', name: '', bucketName: '', storageClass: 'STANDARD', uiVariant: 'file', sortOrder: 100, enabled: true }
  }
  catDialogVisible.value = true
}

function handleCategoryCommand(command: string | number | object, row: Category) {
  if (command === 'delete') {
    deleteCategory(row.code)
    return
  }
  if (command === 'enable' || command === 'disable') {
    toggleCategoryEnabled(row)
  }
}

async function saveCategory() {
  if (!catForm.value.code || !catForm.value.name) { ElMessage.warning('编码和名称必填'); return }
  if (!editingCategory.value && !catForm.value.bucketName) { ElMessage.warning('Bucket 必填'); return }
  catSaving.value = true
  try {
    if (editingCategory.value) {
      await catApi.adminUpdateCategory(catForm.value)
      ElMessage.success('更新成功')
    } else {
      await catApi.adminCreateCategory(catForm.value)
      ElMessage.success('创建成功')
    }
    catDialogVisible.value = false
    await loadCategories()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error ?? '保存失败')
  } finally {
    catSaving.value = false
  }
}

async function toggleCategoryEnabled(row: Category) {
  const action = row.enabled ? '停用' : '启用'
  await ElMessageBox.confirm(`确认${action}分类 ${row.code}？`, '确认', { type: 'warning' })
  try {
    await catApi.adminUpdateCategory({ ...row, enabled: !row.enabled })
    ElMessage.success(`已${action}`)
    await loadCategories()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error ?? `${action}失败`)
  }
}

async function deleteCategory(code: string) {
  await ElMessageBox.confirm(`确认删除分类 ${code}？删除前请确保该分类没有分组和文件。`, '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
  try {
    await catApi.adminDeleteCategory(code)
    ElMessage.success('删除成功')
    if (selectedCat.value === code) { selectedCat.value = ''; groups.value = [] }
    await loadCategories()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error ?? '删除分类失败：该分类可能仍有分组或文件')
  }
}

function openGroupDialog(group?: Group) {
  editingGroup.value = group || null
  if (group) {
    groupForm.value = { groupCode: group.groupCode, groupName: group.groupName, sortOrder: group.sortOrder }
  } else {
    groupForm.value = { groupCode: '', groupName: '', sortOrder: 100 }
  }
  groupDialogVisible.value = true
}

async function saveGroup() {
  if (!groupForm.value.groupCode || !groupForm.value.groupName) { ElMessage.warning('编码和名称必填'); return }
  if (!selectedCat.value) { ElMessage.warning('请先选择分类'); return }
  groupSaving.value = true
  try {
    if (editingGroup.value) {
      await catApi.adminUpdateGroup(selectedCat.value, editingGroup.value.groupCode, groupForm.value)
      ElMessage.success('更新分组成功')
    } else {
      await catApi.adminCreateGroup(selectedCat.value, groupForm.value)
      ElMessage.success('创建分组成功')
    }
    groupDialogVisible.value = false
    await loadGroups()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error ?? '保存分组失败')
  } finally {
    groupSaving.value = false
  }
}

async function deleteGroup(groupCode: string) {
  await ElMessageBox.confirm('确认删除该分组？组内文件将变为未分组，文件不会被删除。', '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
  try {
    await catApi.adminDeleteGroup(selectedCat.value, groupCode)
    ElMessage.success('删除分组成功')
    await loadGroups()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error ?? '删除分组失败')
  }
}

onMounted(async () => {
  await loadCategories()
  await applyRouteIntent()
})
</script>

<style scoped>
.back-button { padding-left: 0; margin-bottom: 8px; color: var(--hive-muted); }
.hero-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
.admin-card { min-height: 520px; }
.card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}
.category-actions { display: flex; align-items: center; gap: 8px; }
.category-header-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
.card-title-stack { display: grid; gap: 6px; min-width: 0; }
.card-title-meta { display: flex; align-items: center; gap: 8px; min-height: 20px; min-width: 0; color: var(--hive-muted); font-size: 0.82rem; }
.card-title-meta strong { color: var(--hive-text); font-weight: 700; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-title-meta span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.group-header-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
.group-actions { display: flex; align-items: center; gap: 8px; }
.danger-dropdown-item { color: var(--hive-danger); }
:deep(.selected-category-row) { --el-table-tr-bg-color: #eff6ff; }
:deep(.category-table .el-table__row) { cursor: pointer; }
.fw-600 { font-weight: 600; }
.ml-2 { margin-left: 8px; }
.text-muted { color: var(--hive-muted); }
.small { font-size: 0.875rem; }
@media (max-width: 900px) { .hero-actions { justify-content: flex-start; } .admin-card { min-height: auto; margin-bottom: 18px; } }
</style>
