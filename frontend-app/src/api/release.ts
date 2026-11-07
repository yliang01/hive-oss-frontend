import client from './client'
export interface ReleaseStatus {
  id: string; version: string; state: string
  archiveSha256: string; configSha256: string; messages: string[]
}
export const getRelease = () => client.get<ReleaseStatus>('/self-release').then(r => r.data)
export const publishRelease = (version: string, password: string) => client.post<ReleaseStatus>('/self-release/publish', { version, password }).then(r => r.data)
export const createTicket = (version: string, seconds: number) => client.post('/self-release/ticket', { version, seconds }, { responseType: 'blob', timeout: 900000 }).then(r => r.data as Blob)
