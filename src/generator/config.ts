export function genConfigCommand(): string {
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

  auth
    .command('bearer <token>')
    .description('Set Bearer token authentication')
    .action((token) => {
      setAuth({ type: 'bearer', token })
      console.log(chalk.green('✓ Auth set to Bearer token'))
    })

  auth
    .command('apikey <key>')
    .description('Set API key authentication')
    .option('--header <name>', 'Header name to use', 'X-API-Key')
    .action((key, opts) => {
      setAuth({ type: 'apikey', key, headerName: opts.header })
      console.log(chalk.green('✓ Auth set to API Key (header: ' + opts.header + ')'))
    })

  auth
    .command('basic <username> <password>')
    .description('Set Basic authentication')
    .action((username, password) => {
      setAuth({ type: 'basic', username, password })
      console.log(chalk.green('✓ Auth set to Basic Auth'))
    })

  set.addCommand(auth)
  config.addCommand(set)

  // ── config show ───────────────────────────────────────────────────────────
  config
    .command('show')
    .description('Show current configuration')
    .action(() => {
      const cfg = getConfig()
      console.log('Base URL :', cfg.baseUrl ?? chalk.gray('(not set)'))
      if (!cfg.auth) {
        console.log('Auth     :', chalk.gray('(not set)'))
        return
      }
      const { type, token, key, username, headerName } = cfg.auth
      if (type === 'bearer') {
        const masked = token ? '***' + token.slice(-4) : '(empty)'
        console.log('Auth     : Bearer ' + masked)
      } else if (type === 'apikey') {
        const masked = key ? '***' + key.slice(-4) : '(empty)'
        console.log('Auth     : API Key (' + (headerName ?? 'X-API-Key') + '): ' + masked)
      } else if (type === 'basic') {
        console.log('Auth     : Basic ' + (username ?? '') + ':****')
      }
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
