import type { ParsedSpec } from '../types.js'

export function genListCommand(parsed: ParsedSpec): string {
  const endpointsJson = JSON.stringify(
    parsed.endpoints.map((ep) => ({
      tag: ep.tag,
      method: ep.method,
      path: ep.path,
      operationId: ep.operationId,
      summary: ep.summary ?? '',
    })),
    null,
    2,
  )

  return `import { Command } from 'commander'
import chalk from 'chalk'

const ENDPOINTS = ${endpointsJson}

const METHOD_COLOR = {
  GET: chalk.green,
  POST: chalk.yellow,
  PUT: chalk.blue,
  PATCH: chalk.cyan,
  DELETE: chalk.red,
}

export function createListCommand() {
  return new Command('list')
    .description('List all available API endpoints')
    .option('--tag <name>', 'Filter by tag')
    .option('--output <format>', 'Output format: table|json', 'table')
    .action((opts) => {
      let list = ENDPOINTS
      if (opts.tag) {
        list = list.filter((e) => e.tag === opts.tag)
      }

      if (opts.output === 'json') {
        console.log(JSON.stringify(list, null, 2))
        return
      }

      // Group by tag
      const groups = {}
      for (const ep of list) {
        groups[ep.tag] = groups[ep.tag] ?? []
        groups[ep.tag].push(ep)
      }

      for (const [tag, eps] of Object.entries(groups)) {
        console.log(chalk.bold.underline(tag))
        for (const ep of eps) {
          const colorFn = METHOD_COLOR[ep.method] ?? ((s) => s)
          const method = colorFn(ep.method.padEnd(6))
          const op = chalk.cyan(ep.operationId.padEnd(30))
          const summary = ep.summary ? chalk.gray(' — ' + ep.summary) : ''
          console.log('  ' + method + ' ' + ep.path.padEnd(40) + ' ' + op + summary)
        }
        console.log()
      }

      console.log(chalk.gray('Total: ' + list.length + ' endpoint(s)'))
    })
}
`
}
