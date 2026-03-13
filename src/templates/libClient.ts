export function genLibClient(): string {
  return `import axios from 'axios'
import { getConfig } from './config.js'

export function createClient() {
  const config = getConfig()
  const client = axios.create({ baseURL: config.baseUrl ?? '' })

  client.interceptors.request.use((req) => {
    const auth = config.auth
    if (!auth) return req

    if (auth.type === 'bearer' && auth.token) {
      req.headers['Authorization'] = 'Bearer ' + auth.token
    } else if (auth.type === 'token' && auth.token) {
      req.headers['Authorization'] = auth.token
    } else if (auth.type === 'apikey' && auth.key) {
      if (auth.inQuery) {
        req.params = { ...req.params, [auth.headerName ?? 'api_key']: auth.key }
      } else {
        req.headers[auth.headerName ?? 'X-API-Key'] = auth.key
      }
    } else if (auth.type === 'basic' && auth.username && auth.password) {
      const encoded = Buffer.from(auth.username + ':' + auth.password).toString('base64')
      req.headers['Authorization'] = 'Basic ' + encoded
    }

    return req
  })

  return client
}
`
}
