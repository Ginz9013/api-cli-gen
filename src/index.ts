import { Command } from 'commander'
import chalk from 'chalk'
import { generate } from './generator/index.js'
import { preview } from './generator/preview.js'

const program = new Command()

program
  .name('api-cli-gen')
  .description('Generate a CLI tool from an OpenAPI spec')
  .version('0.1.0')

program
  .command('generate')
  .description('Generate a CLI project from an OpenAPI spec')
  .argument('<spec>', 'Path to OpenAPI spec file (.json/.yaml) or URL')
  .option('-o, --output <dir>', 'Output directory (default: ./generated/<cli-name>)')
  .option('-n, --name <name>', 'CLI binary name (default: derived from spec title)')
  .action(async (spec: string, opts: { output?: string; name?: string }) => {
    try {
      await generate({ spec, output: opts.output, name: opts.name })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(chalk.red(`Error: ${msg}`))
      process.exit(1)
    }
  })

program
  .command('preview')
  .description('Preview commands that would be generated (no files written)')
  .argument('<spec>', 'Path to OpenAPI spec file (.json/.yaml) or URL')
  .option('-n, --name <name>', 'CLI binary name')
  .action(async (spec: string, opts: { name?: string }) => {
    try {
      await preview({ spec, name: opts.name })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(chalk.red(`Error: ${msg}`))
      process.exit(1)
    }
  })

program
  .command('update')
  .description('Re-generate CLI from updated spec (preserves existing config)')
  .argument('<spec>', 'Path to OpenAPI spec file (.json/.yaml) or URL')
  .option('-o, --output <dir>', 'Output directory (default: ./generated/<cli-name>)')
  .option('-n, --name <name>', 'CLI binary name')
  .action(async (spec: string, opts: { output?: string; name?: string }) => {
    try {
      await generate({ spec, output: opts.output, name: opts.name, update: true })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(chalk.red(`Error: ${msg}`))
      process.exit(1)
    }
  })

program.parse()
