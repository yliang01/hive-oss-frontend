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

export const adminDeleteCategory = (code: string) =>
  client.delete(`/categories/${code}`)

export const adminGetGroups = (categoryCode: string) =>
  client.get<Group[]>(`/categories/${categoryCode}/groups`)

export const adminCreateGroup = (categoryCode: string, data: Partial<Group>) =>
  client.post<Group>(`/categories/${categoryCode}/groups`, data)

export const adminUpdateGroup = (categoryCode: string, groupCode: string, data: Partial<Group>) =>
  client.put<Group>(`/categories/${categoryCode}/groups/${groupCode}`, data)

export const adminDeleteGroup = (categoryCode: string, groupCode: string) =>
  client.delete(`/categories/${categoryCode}/groups/${groupCode}`)
