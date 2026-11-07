import { setupClient as client } from './client'

export interface SetupStatus {
  ready: boolean; state: string; candidate: string; message: string; runningBuild: string
}
export const getSetup = () => client.get<SetupStatus>('/setup').then(r => r.data)
export const downloadConfiguration = (ticket: string) => client.post<SetupStatus>('/setup/download', { ticket }, { timeout: 900000 }).then(r => r.data)
export const unlockConfiguration = (password: string) => client.post<SetupStatus>('/setup/unlock', { password }, { timeout: 900000 }).then(r => r.data)
export const loadSecretYaml = (content: string) => client.post<SetupStatus>('/setup/yaml', { content }, { timeout: 900000 }).then(r => r.data)
