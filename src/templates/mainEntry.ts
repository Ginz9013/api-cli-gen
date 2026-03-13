import type { ParsedSpec } from '../types.js'

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function genMainEntry(cliName: string, parsed: ParsedSpec, tags: string[]): string {
  const imports = tags
    .map((tag) => `import { create${capitalize(tag)}Command } from './commands/${tag}.js'`)
    .join('\n')

  const addCommands = tags
    .map((tag) => `program.addCommand(create${capitalize(tag)}Command())`)
    .join('\n')

  return `import { Command } from 'commander'
import { createConfigCommand } from './commands/config.js'
import { createListCommand } from './commands/list.js'
${imports}

const program = new Command()

program
  .name('${cliName}')
  .description('${parsed.title} CLI (v${parsed.version})')
  .version('${parsed.version}')

program.addCommand(createConfigCommand())
program.addCommand(createListCommand())
${addCommands}

program.parse()
`
}
