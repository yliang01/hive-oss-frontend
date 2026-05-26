import client from './client'
import type { Category, Group } from '@/types'

export const getCategories = () =>
  client.get<Category[]>('/categories')

export const getCategoryGroups = (category: string) =>
  client.get<Group[]>(`/categories/${category}/groups`)

export const adminGetCategories = () =>
  client.get<Category[]>('/category-admin/categories')

export const adminCreateCategory = (data: Partial<Category>) =>
  client.post<Category>('/category-admin/categories', data)

export const adminUpdateCategory = (code: string, data: Partial<Category>) =>
  client.put<Category>(`/category-admin/categories/${code}`, data)

export const adminDisableCategory = (code: string) =>
  client.post(`/category-admin/categories/${code}/disable`)

export const adminDeleteCategory = (code: string) =>
  client.delete(`/category-admin/categories/${code}`)

export const adminGetGroups = (categoryCode: string) =>
  client.get<Group[]>(`/category-admin/categories/${categoryCode}/groups`)

export const adminCreateGroup = (categoryCode: string, data: Partial<Group>) =>
  client.post<Group>(`/category-admin/categories/${categoryCode}/groups`, data)

export const adminUpdateGroup = (categoryCode: string, groupId: number, data: Partial<Group>) =>
  client.put<Group>(`/category-admin/categories/${categoryCode}/groups/${groupId}`, data)

export const adminDeleteGroup = (categoryCode: string, groupId: number) =>
  client.delete(`/category-admin/categories/${categoryCode}/groups/${groupId}`)
