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
          <p class="ops-subtitle">维护对象存储分类、展示模式、存储层和分组结构。左侧选择分类后，右侧管理对应分组。</p>
        </div>
        <div class="hero-actions">
          <el-button :loading="catLoading" @click="loadCategories">
            <el-icon><Refresh /></el-icon>刷新
          </el-button>
          <el-button type="primary" @click="openCategoryDialog()">新增分类</el-button>
        </div>
      </header>

      <el-row :gutter="24">
        <el-col :xs="24" :lg="12">
          <el-card class="admin-card" shadow="never">
            <template #header>
              <div class="card-header-row">
                <div class="ops-card-title">
                  <span class="ops-icon-box"><el-icon><Grid /></el-icon></span>
                  <span>分类列表</span>
                </div>
                <el-tag type="info" effect="plain">{{ categories.length }} 项</el-tag>
              </div>
            </template>
            <el-table :data="categories" v-loading="catLoading" size="small" :row-class-name="categoryRowClass" @row-click="row => selectCategory(row.code)">
              <el-table-column prop="code" label="编码" width="110" />
              <el-table-column prop="name" label="名称" />
              <el-table-column prop="storageClass" label="存储层" width="100" />
              <el-table-column label="视图" width="90">
                <template #default="{ row }">
                  <el-tag size="small" effect="plain">{{ variantLabel(row.uiVariant) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="启用" width="60">
                <template #default="{ row }">
                  <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '是' : '否' }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="160">
                <template #default="{ row }">
                  <el-button link size="small" @click="selectCategory(row.code)">分组</el-button>
                  <el-button link size="small" @click="openCategoryDialog(row)">编辑</el-button>
                  <el-button link size="small" type="warning" @click="disableCategory(row.code)">停用</el-button>
                  <el-button link size="small" type="danger" @click="deleteCategory(row.code)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>

        <el-col :xs="24" :lg="12">
          <el-card class="admin-card" shadow="never">
            <template #header>
              <div class="card-header-row">
                <div class="ops-card-title">
                  <span class="ops-icon-box"><el-icon><Connection /></el-icon></span>
                  <span>分组列表</span>
                </div>
                <el-tag v-if="selectedCat" size="small" type="primary" effect="plain">{{ selectedCat }}</el-tag>
                <span v-else class="text-muted small">请先选择分类</span>
                <el-button type="primary" size="small" :disabled="!selectedCat" @click="openGroupDialog()">新增分组</el-button>
              </div>
            </template>
            <div v-if="selectedCategory" class="selected-summary">
              <div>
                <strong>{{ selectedCategory.name }}</strong>
                <span>{{ selectedCategory.code }} · {{ selectedCategory.storageClass }} · {{ variantLabel(selectedCategory.uiVariant) }}</span>
              </div>
              <el-tag :type="selectedCategory.enabled ? 'success' : 'info'">{{ selectedCategory.enabled ? '启用' : '停用' }}</el-tag>
            </div>
            <el-table :data="groups" v-loading="groupLoading" size="small" stripe>
              <el-table-column prop="groupCode" label="编码" width="110" />
              <el-table-column prop="groupName" label="名称" />
              <el-table-column label="启用" width="60">
                <template #default="{ row }">
                  <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '是' : '否' }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="120">
                <template #default="{ row }">
                  <el-button link size="small" @click="openGroupDialog(row)">编辑</el-button>
                  <el-button link size="small" type="danger" @click="deleteGroup(row.groupId)">删除</el-button>
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
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as catApi from '@/api/categories'
import type { Category, Group } from '@/types'

const router = useRouter()

const categories = ref<Category[]>([])
const catLoading = ref(false)
const groups = ref<Group[]>([])
const groupLoading = ref(false)
const selectedCat = ref('')

const selectedCategory = computed(() => categories.value.find(c => c.code === selectedCat.value) || null)

type CategoryForm = Pick<Category, 'code' | 'name' | 'bucketName' | 'storageClass' | 'uiVariant' | 'sortOrder' | 'enabled'>
type GroupForm = Pick<Group, 'groupCode' | 'groupName' | 'sortOrder' | 'enabled'>

// Category dialog
const catDialogVisible = ref(false)
const catSaving = ref(false)
const editingCategory = ref<Category | null>(null)
const catForm = ref<CategoryForm>({ code: '', name: '', bucketName: '', storageClass: 'STANDARD', uiVariant: 'file', sortOrder: 100, enabled: true })

// Group dialog
const groupDialogVisible = ref(false)
const groupSaving = ref(false)
const editingGroup = ref<Group | null>(null)
const groupForm = ref<GroupForm>({ groupCode: '', groupName: '', sortOrder: 100, enabled: true })

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

async function disableCategory(code: string) {
  await ElMessageBox.confirm(`确认停用分类 ${code}？`, '确认', { type: 'warning' })
  try {
    await catApi.adminDisableCategory(code)
    ElMessage.success('已停用')
    await loadCategories()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error ?? '停用失败')
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
    groupForm.value = { groupCode: group.groupCode, groupName: group.groupName, sortOrder: group.sortOrder, enabled: group.enabled }
  } else {
    groupForm.value = { groupCode: '', groupName: '', sortOrder: 100, enabled: true }
  }
  groupDialogVisible.value = true
}

async function saveGroup() {
  if (!groupForm.value.groupCode || !groupForm.value.groupName) { ElMessage.warning('编码和名称必填'); return }
  if (!selectedCat.value) { ElMessage.warning('请先选择分类'); return }
  groupSaving.value = true
  try {
    if (editingGroup.value) {
      await catApi.adminUpdateGroup(selectedCat.value, editingGroup.value.groupId, groupForm.value)
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

async function deleteGroup(groupId: number) {
  await ElMessageBox.confirm('确认删除该分组？', '确认删除', { type: 'warning' })
  try {
    await catApi.adminDeleteGroup(selectedCat.value, groupId)
    ElMessage.success('删除分组成功')
    await loadGroups()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error ?? '删除分组失败（可能仍关联文件）')
  }
}

onMounted(loadCategories)
</script>

<style scoped>
.back-button { padding-left: 0; margin-bottom: 8px; color: var(--hive-muted); }
.hero-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
.admin-card { min-height: 520px; }
.card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.selected-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
  padding: 14px 16px;
  border: 1px solid #bfdbfe;
  border-radius: 14px;
  background: linear-gradient(135deg, #eff6ff, #ffffff);
}
.selected-summary strong { display: block; margin-bottom: 4px; }
.selected-summary span { color: var(--hive-muted); font-size: 0.82rem; }
:deep(.selected-category-row) { --el-table-tr-bg-color: #eff6ff; }
:deep(.el-table__row) { cursor: pointer; }
.fw-600 { font-weight: 600; }
.ml-2 { margin-left: 8px; }
.text-muted { color: var(--hive-muted); }
.small { font-size: 0.875rem; }
@media (max-width: 900px) { .hero-actions { justify-content: flex-start; } .admin-card { min-height: auto; margin-bottom: 18px; } }
</style>
