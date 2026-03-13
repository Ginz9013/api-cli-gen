import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import chalk from 'chalk'
import type { ParsedSpec } from '../types.js'
import { genPackageJson } from '../templates/packageJson.js'
import { genTsConfig } from '../templates/tsconfig.js'
import { genBuildScript } from '../templates/buildScript.js'
import { genMainEntry } from '../templates/mainEntry.js'
import { genLibConfig } from '../templates/libConfig.js'
import { genLibClient } from '../templates/libClient.js'
import { genUtilsOutput } from '../templates/utilsOutput.js'
import { genConfigCommand } from './config.js'
import { genListCommand } from './list.js'
import { genTagCommand, toSafeTagName } from './commands.js'

function write(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf-8')
}

export async function writeProject(opts: {
  parsed: ParsedSpec
  cliName: string
  outputDir: string
  update?: boolean
}): Promise<void> {
  const { parsed, cliName, outputDir, update } = opts

  // Group endpoints by tag
  const byTag = new Map<string, typeof parsed.endpoints>()
  for (const ep of parsed.endpoints) {
    const list = byTag.get(ep.tag) ?? []
    list.push(ep)
    byTag.set(ep.tag, list)
  }

  const tags = Array.from(byTag.keys())

  // ── Project config files ───────────────────────────────────────────────────
  if (!update) {
    write(path.join(outputDir, 'package.json'), genPackageJson(cliName))
    write(path.join(outputDir, 'tsconfig.json'), genTsConfig())
    write(path.join(outputDir, 'build.mjs'), genBuildScript())
  }

  // ── Source files ───────────────────────────────────────────────────────────
  write(path.join(outputDir, 'src', 'index.ts'), genMainEntry(cliName, parsed, tags))
  write(path.join(outputDir, 'src', 'lib', 'config.ts'), genLibConfig(cliName))
  write(path.join(outputDir, 'src', 'lib', 'client.ts'), genLibClient())
  write(path.join(outputDir, 'src', 'utils', 'output.ts'), genUtilsOutput())
  write(path.join(outputDir, 'src', 'commands', 'config.ts'), genConfigCommand())
  write(path.join(outputDir, 'src', 'commands', 'list.ts'), genListCommand(parsed))

  for (const [tag, endpoints] of byTag) {
    write(path.join(outputDir, 'src', 'commands', `${toSafeTagName(tag)}.ts`), genTagCommand(tag, endpoints))
  }

  // ── Install & build ────────────────────────────────────────────────────────
  if (!update) {
    console.log(chalk.blue('\nInstalling dependencies...'))
    execSync('npm install', { cwd: outputDir, stdio: 'inherit' })
  }

  console.log(chalk.blue('Building...'))
  execSync('node build.mjs', { cwd: outputDir, stdio: 'inherit' })

  console.log(chalk.green(`✓ Build complete → ${path.join(outputDir, 'dist', 'index.js')}`))
}
