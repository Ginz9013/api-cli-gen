import type { ParsedSpec, SecurityScheme } from '../types.js'

function genAuthCommands(schemes: SecurityScheme[]): string {
  if (schemes.length === 0) {
    // No securitySchemes defined — expose all auth types as fallback
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
    .description('Set API key  →  X-API-Key: <key>')
    .option('--header <name>', 'Header name', 'X-API-Key')
    .action((key, opts) => {
      setAuth({ type: 'apikey', key, headerName: opts.header })
      console.log(chalk.green('✓ Auth set to API Key (header: ' + opts.header + ')'))
    })

  auth
    .command('basic <username> <password>')
    .description('Set Basic auth  →  Authorization: Basic <base64>')
    .action((username, password) => {
      setAuth({ type: 'basic', username, password })
      console.log(chalk.green('✓ Auth set to Basic Auth'))
    })`
  }

  const blocks: string[] = []

  for (const s of schemes) {
    if (s.type === 'bearer') {
      blocks.push(`
  auth
    .command('bearer <token>')
    .description('Set Bearer token  →  Authorization: Bearer <token>')
    .action((token) => {
      setAuth({ type: 'bearer', token })
      console.log(chalk.green('✓ Auth set to Bearer token'))
    })`)
    }

    if (s.type === 'apikey') {
      const defaultHeader = s.paramName ?? 'X-API-Key'
      const location = s.in === 'query' ? 'query param' : `header: ${defaultHeader}`
      blocks.push(`
  auth
    .command('apikey <key>')
    .description('Set API key  →  ${location}')
    .option('--header <name>', 'Header name', ${JSON.stringify(defaultHeader)})
    .action((key, opts) => {
      setAuth({ type: 'apikey', key, headerName: opts.header, inQuery: ${s.in === 'query'} })
      console.log(chalk.green('✓ Auth set to API Key'))
    })`)
    }

    if (s.type === 'basic') {
      blocks.push(`
  auth
    .command('basic <username> <password>')
    .description('Set Basic auth  →  Authorization: Basic <base64>')
    .action((username, password) => {
      setAuth({ type: 'basic', username, password })
      console.log(chalk.green('✓ Auth set to Basic Auth'))
    })`)
    }

    if (s.type === 'oauth2') {
      blocks.push(`
  auth
    .command('bearer <token>')
    .description('Set OAuth2 Bearer token  →  Authorization: Bearer <token>')
    .action((token) => {
      setAuth({ type: 'bearer', token })
      console.log(chalk.green('✓ Auth set to OAuth2 Bearer token'))
    })`)
    }
  }

  // Deduplicate (e.g. multiple oauth2 schemes all map to bearer)
  return [...new Set(blocks)].join('\n')
}

function genShowAuth(schemes: SecurityScheme[]): string {
  const types = schemes.length === 0
    ? ['bearer', 'token', 'apikey', 'basic']
    : [...new Set(schemes.map((s) => (s.type === 'oauth2' ? 'bearer' : s.type)))]

  const lines: string[] = [`      const { type, token, key, username, headerName } = cfg.auth`]

  if (types.includes('bearer') || types.includes('token')) {
    lines.push(`      if (type === 'bearer') {
        console.log('Auth     : Bearer ***' + (token?.slice(-4) ?? ''))
      } else if (type === 'token') {
        console.log('Auth     : Token (raw) ***' + (token?.slice(-4) ?? ''))
      }`)
  }
  if (types.includes('apikey')) {
    lines.push(`      else if (type === 'apikey') {
        console.log('Auth     : API Key (' + (headerName ?? 'X-API-Key') + ') ***' + (key?.slice(-4) ?? ''))
      }`)
  }
  if (types.includes('basic')) {
    lines.push(`      else if (type === 'basic') {
        console.log('Auth     : Basic ' + (username ?? '') + ':****')
      }`)
  }

  return lines.join('\n')
}

function genSecurityHint(schemes: SecurityScheme[]): string {
  if (schemes.length === 0) return ''
  const hints = schemes.map((s) => {
    if (s.type === 'bearer') return `Bearer token (Authorization: Bearer <token>)`
    if (s.type === 'oauth2') return `OAuth2 Bearer token`
    if (s.type === 'apikey') return `API Key (${s.in}: ${s.paramName ?? 'X-API-Key'})`
    if (s.type === 'basic') return `Basic Auth (username + password)`
    return s.type
  })
  return `\n  console.log(chalk.gray('  Auth required: ${hints.join(' | ')}'))`
}

export function genConfigCommand(parsed: ParsedSpec): string {
  const authCommands = genAuthCommands(parsed.security)
  const showAuth = genShowAuth(parsed.security)
  const securityHint = genSecurityHint(parsed.security)

  return `import { Command } from 'commander'
import chalk from 'chalk'
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
      if (!cfg.auth) {
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
