export function genBuildScript(): string {
  return `import * as esbuild from 'esbuild'
import { readFileSync, writeFileSync, chmodSync, mkdirSync } from 'fs'

mkdirSync('dist', { recursive: true })

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: 'dist/index.js',
})

// Prepend shebang
const content = readFileSync('dist/index.js', 'utf-8')
writeFileSync('dist/index.js', '#!/usr/bin/env node\\n' + content)
chmodSync('dist/index.js', 0o755)

console.log('Build complete → dist/index.js')
`
}
