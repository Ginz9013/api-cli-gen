import chalk from 'chalk'
import { loadSpec } from '../parser/loader.js'
import { analyzeSpec } from '../parser/analyzer.js'
import { toKebabCase } from './index.js'

const METHOD_COLOR: Record<string, (s: string) => string> = {
  GET: chalk.green,
  POST: chalk.yellow,
  PUT: chalk.blue,
  PATCH: chalk.cyan,
  DELETE: chalk.red,
}

export async function preview(opts: { spec: string; name?: string }): Promise<void> {
  console.log(chalk.blue(`Loading spec from ${opts.spec}...`))
  const doc = await loadSpec(opts.spec)
  const parsed = analyzeSpec(doc)

  const cliName = opts.name ? toKebabCase(opts.name) : toKebabCase(parsed.title) || 'my-api-cli'

  console.log(`\n${chalk.bold(`CLI: ${cliName}`)}  ${chalk.gray(`(${parsed.title} v${parsed.version})`)}\n`)

  const tagGroups = new Map<string, typeof parsed.endpoints>()
  for (const ep of parsed.endpoints) {
    const list = tagGroups.get(ep.tag) ?? []
    list.push(ep)
    tagGroups.set(ep.tag, list)
  }

  for (const [tag, eps] of tagGroups) {
    console.log(chalk.bold.underline(tag))
    for (const ep of eps) {
      const colorFn = METHOD_COLOR[ep.method] ?? ((s: string) => s)
      const cmd = `  ${cliName} ${tag} ${ep.operationId}`
      const method = colorFn(ep.method.padEnd(6))
      const summary = ep.summary ? chalk.gray(` — ${ep.summary}`) : ''
      console.log(`${chalk.cyan(cmd.padEnd(50))} ${method} ${ep.path}${summary}`)
    }
    console.log()
  }

  console.log(
    chalk.gray(
      `Total: ${parsed.endpoints.length} endpoints across ${parsed.tags.length} tag(s)`,
    ),
  )
  console.log(chalk.gray(`Built-in commands: ${cliName} config, ${cliName} list`))
}
