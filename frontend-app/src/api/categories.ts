import client from './client'
import type { Category, Group } from '@/types'

export const getCategories = () =>
  client.get<Category[]>('/categories')

export const getCategoryGroups = (category: string) =>
  client.get<Group[]>(`/categories/${category}/groups`)

export const adminGetCategories = () =>
  client.get<Category[]>('/categories', { params: { includeDisabled: true } })

export const adminCreateCategory = (data: Partial<Category>) =>
  client.post<Category>('/categories', data)

export const adminUpdateCategory = (data: Partial<Category>) =>
  client.put<Category>('/categories', data)

export const adminDisableCategory = (code: string) =>
  client.post(`/categories/${code}/disable`)

export const adminDeleteCategory = (code: string) =>
  client.delete(`/categories/${code}`)

export const adminGetGroups = (categoryCode: string) =>
  client.get<Group[]>(`/categories/${categoryCode}/groups`, { params: { includeDisabled: true } })

export const adminCreateGroup = (categoryCode: string, data: Partial<Group>) =>
  client.post<Group>(`/categories/${categoryCode}/groups`, data)

export const adminUpdateGroup = (categoryCode: string, groupId: number, data: Partial<Group>) =>
  client.put<Group>(`/categories/${categoryCode}/groups/${groupId}`, data)

export const adminDeleteGroup = (categoryCode: string, groupId: number) =>
  client.delete(`/categories/${categoryCode}/groups/${groupId}`)
