import type { ParsedSpec, SecurityScheme } from '../types.js'

function genAuthCommands(schemes: SecurityScheme[]): string {
  // Always expose all auth types — real-world APIs often use auth methods
  // (e.g. Basic Auth for a login endpoint) that aren't declared in securitySchemes.
  const apikeySchemes = schemes.filter((s) => s.type === 'apikey')
  const primaryApikey = apikeySchemes[0]
  const defaultHeader = primaryApikey?.paramName ?? 'X-API-Key'
  const defaultIn = primaryApikey?.in === 'query' ? 'query' : 'header'
  let apikeyDesc = `Set API key  →  ${defaultIn}: ${defaultHeader}`
  if (apikeySchemes.length > 1) {
    const list = apikeySchemes
      .map((s) => `${s.in ?? 'header'}: ${s.paramName ?? '?'}`)
      .join(', ')
    apikeyDesc += `  (spec declares: ${list})`
  }

  const ccScheme = schemes.find((s) => s.type === 'oauth2' && s.clientCredentialsUrl)

  const oauth2Command = ccScheme
    ? `

  auth
    .command('oauth2 <clientId> <clientSecret>')
    .description('Exchange OAuth2 client credentials for a bearer token')
    .option('--scope <scope>', 'OAuth2 scope (space-separated)')
    .action(async (clientId, clientSecret, opts) => {
      try {
        const body = new URLSearchParams({ grant_type: 'client_credentials' })
        if (opts.scope) body.append('scope', opts.scope)
        const res = await axios.post(${JSON.stringify(ccScheme.clientCredentialsUrl)}, body, {
          auth: { username: clientId, password: clientSecret },
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
        const token = res.data?.access_token
        if (!token) throw new Error('No access_token in response: ' + JSON.stringify(res.data))
        setAuth({ type: 'bearer', token })
        console.log(chalk.green('✓ Got access token, saved as Bearer'))
      } catch (e) {
        const detail = e.response?.data ? JSON.stringify(e.response.data) : e.message
        console.error(chalk.red('Error: ' + detail))
        process.exit(1)
      }
    })`
    : ''

  return `
  auth
    .command('bearer <token>')
    .description('Set Bearer token  →  Authorization: Bearer <token>')
    .action((token) => {
      setAuth({ type: 'bearer', token })
      console.log(chalk.green('✓ Auth set to Bearer token'))
    })

  auth
    .command('token <token>')
    .description('Set raw token  →  Authorization: <token>  (no prefix)')
    .action((token) => {
      setAuth({ type: 'token', token })
      console.log(chalk.green('✓ Auth set to raw token'))
    })

  auth
    .command('apikey <key>')
    .description(${JSON.stringify(apikeyDesc)})
    .option('--in <location>', 'Where to send: header|query', ${JSON.stringify(defaultIn)})
    .option('--header <name>', 'Header or query param name', ${JSON.stringify(defaultHeader)})
    .action((key, opts) => {
      if (opts.in !== 'header' && opts.in !== 'query') {
        console.error(chalk.red('Error: --in must be "header" or "query"'))
        process.exit(1)
      }
      const inQuery = opts.in === 'query'
      setAuth({ type: 'apikey', key, headerName: opts.header, inQuery })
      console.log(chalk.green('✓ Auth set to API Key (' + opts.in + ': ' + opts.header + ')'))
    })

  auth
    .command('basic <username> <password>')
    .description('Set Basic auth  →  Authorization: Basic <base64>')
    .action((username, password) => {
      setAuth({ type: 'basic', username, password })
      console.log(chalk.green('✓ Auth set to Basic Auth'))
    })${oauth2Command}`
}

function genShowAuth(_schemes: SecurityScheme[]): string {
  return `      for (const auth of cfg.auths) {
        const { type, token, key, username, headerName, inQuery } = auth
        if (type === 'bearer') {
          console.log('Auth     : Bearer ***' + (token?.slice(-4) ?? ''))
        } else if (type === 'token') {
          console.log('Auth     : Token (raw) ***' + (token?.slice(-4) ?? ''))
        } else if (type === 'apikey') {
          const loc = inQuery ? 'query' : 'header'
          console.log('Auth     : API Key (' + loc + ': ' + headerName + ') ***' + (key?.slice(-4) ?? ''))
        } else if (type === 'basic') {
          console.log('Auth     : Basic ' + (username ?? '') + ':****')
        }
      }`
}

function genSecurityHint(schemes: SecurityScheme[]): string {
  if (schemes.length === 0) return ''
  const hints = schemes.map((s) => {
    if (s.type === 'bearer') return `Bearer token (Authorization: Bearer <token>)`
    if (s.type === 'oauth2') {
      if (s.clientCredentialsUrl) return `OAuth2 client_credentials → use: auth oauth2 <id> <secret>`
      if (s.tokenUrl) return `OAuth2 (tokenUrl: ${s.tokenUrl}) → fetch externally, use: auth bearer <token>`
      return `OAuth2 → fetch token externally, use: auth bearer <token>`
    }
    if (s.type === 'apikey') return `API Key (${s.in ?? 'header'}: ${s.paramName ?? 'X-API-Key'})`
    if (s.type === 'basic') return `Basic Auth (username + password)`
    return s.type
  })
  return `\n  console.log(chalk.gray('  Auth required: ${hints.join(' | ')}'))`
}

export function genConfigCommand(parsed: ParsedSpec): string {
  const authCommands = genAuthCommands(parsed.security)
  const showAuth = genShowAuth(parsed.security)
  const securityHint = genSecurityHint(parsed.security)
  const needsAxios = parsed.security.some((s) => s.type === 'oauth2' && s.clientCredentialsUrl)
  const axiosImport = needsAxios ? `\nimport axios from 'axios'` : ''

  return `import { Command } from 'commander'
import chalk from 'chalk'${axiosImport}
import { getConfig, setBaseUrl, setAuth, resetConfig } from '../lib/config.js'

export function createConfigCommand() {
  const config = new Command('config').description('Manage CLI configuration')

  // ── config set ────────────────────────────────────────────────────────────
  const set = new Command('set').description('Set a configuration value')

  set
    .command('base-url <url>')
    .description('Set the API base URL')
    .action((url) => {
      setBaseUrl(url)
      console.log(chalk.green('✓ Base URL set to ' + url))
    })

  const auth = new Command('auth').description('Set authentication credentials')
${authCommands}

  set.addCommand(auth)
  config.addCommand(set)

  // ── config show ───────────────────────────────────────────────────────────
  config
    .command('show')
    .description('Show current configuration')
    .action(() => {
      const cfg = getConfig()
      console.log('Base URL :', cfg.baseUrl ?? chalk.gray('(not set)'))${securityHint}
      if (!cfg.auths || cfg.auths.length === 0) {
        console.log('Auth     :', chalk.gray('(not set)'))
        return
      }
${showAuth}
    })

  // ── config reset ──────────────────────────────────────────────────────────
  config
    .command('reset')
    .description('Clear all configuration')
    .action(() => {
      resetConfig()
      console.log(chalk.green('✓ Configuration reset'))
    })

  return config
}
`
}
