import path from 'path'
import chalk from 'chalk'
import { loadSpec } from '../parser/loader.js'
import { analyzeSpec } from '../parser/analyzer.js'
import { writeProject } from './project.js'
import type { GenerateOptions } from '../types.js'

export function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function generate(opts: GenerateOptions): Promise<void> {
  console.log(chalk.blue(`Loading spec from ${opts.spec}...`))
  const doc = await loadSpec(opts.spec)

  console.log(chalk.blue('Analyzing spec...'))
  const parsed = analyzeSpec(doc)

  const cliName = opts.name ? toKebabCase(opts.name) : toKebabCase(parsed.title) || 'my-api-cli'
  const relativeOutput = opts.output ?? path.join('generated', cliName)
  const outputDir = path.resolve(process.cwd(), relativeOutput)

  console.log(chalk.blue(`Generating CLI "${cliName}" → ${outputDir}`))

  await writeProject({ parsed, cliName, outputDir, update: opts.update })

  console.log(chalk.green(`\n✓ CLI "${cliName}" generated successfully!`))
  console.log(chalk.gray(`  Directory : ${outputDir}`))
  console.log(chalk.gray(`  Run directly : node ${path.join(relativeOutput, 'dist/index.js')} --help`))
  console.log(chalk.gray(`  Install globally: cd ${relativeOutput} && npm link`))
}
