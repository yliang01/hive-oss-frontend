import axios from 'axios'

const client = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE ?? ''}/api`,
  timeout: 60000,
})

export const setupClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE ?? '',
  timeout: 60000,
})

export default client
