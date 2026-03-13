import type { ParsedSpec } from '../types.js'
import { toSafeTagName, toSafeFunctionName } from '../generator/commands.js'

export function genMainEntry(cliName: string, parsed: ParsedSpec, tags: string[]): string {
  const imports = tags
    .map(
      (tag) =>
        `import { create${toSafeFunctionName(tag)}Command } from './commands/${toSafeTagName(tag)}.js'`,
    )
    .join('\n')

  const addCommands = tags
    .map((tag) => `program.addCommand(create${toSafeFunctionName(tag)}Command())`)
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
