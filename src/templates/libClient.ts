export function genLibClient(): string {
  return `import axios from 'axios'
import { getConfig } from './config.js'

export function createClient(verbose = false) {
  const config = getConfig()
  const client = axios.create({ baseURL: config.baseUrl ?? '' })

  client.interceptors.request.use((req) => {
    for (const auth of config.auths ?? []) {
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
    }

    if (verbose) {
      const base = req.baseURL ?? ''
      const path = req.url ?? ''
      console.log('[' + req.method?.toUpperCase() + ']', base + path)
      const authHeader = req.headers['Authorization'] ?? req.headers['authorization']
      if (authHeader) {
        const val = String(authHeader)
        const masked = val.length > 12 ? val.slice(0, 10) + '***' + val.slice(-4) : '***'
        console.log('Authorization:', masked)
      }
      if (req.params && Object.keys(req.params).length) console.log('Query :', req.params)
      if (req.data) console.log('Body  :', req.data)
    }

    return req
  })

  return client
}
`
}
