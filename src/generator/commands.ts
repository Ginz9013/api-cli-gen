import type { Endpoint } from '../types.js'

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** tag → safe file/command name  e.g. "websocket / rooms" → "websocket-rooms" */
export function toSafeTagName(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** tag → safe PascalCase function name  e.g. "websocket / rooms" → "WebsocketRooms" */
export function toSafeFunctionName(tag: string): string {
  return toSafeTagName(tag)
    .split('-')
    .map(capitalize)
    .join('')
}

// Build a URL expression string for the generated TypeScript code.
// Handles both OpenAPI `{petId}` and Express `:petId` path param styles.
// e.g. /pet/{petId} → `\`/pet/\${params.path?.['petId']}\``
// e.g. /pet/:petId  → `\`/pet/\${params.path?.['petId']}\``
function buildUrlExpr(urlPath: string): string {
  const converted = urlPath
    .replace(
      /\{([^}]+)\}/g,
      (_, name: string) => `\${params.path?.['${name}']}`,
    )
    .replace(
      /:([a-zA-Z_][a-zA-Z0-9_]*)/g,
      (_, name: string) => `\${params.path?.['${name}']}`,
    )
  return '`' + converted + '`'
}

function buildRequestCode(ep: Endpoint): string {
  const method = ep.method.toLowerCase()
  const withBody = ['post', 'put', 'patch'].includes(method)
  if (withBody) {
    return `const res = await client.${method}(url, params.body ?? {}, { params: params.query })`
  }
  return `const res = await client.${method}(url, { params: params.query })`
}

function buildValidations(ep: Endpoint): string {
  const lines: string[] = []
  for (const p of ep.pathParams.filter((x) => x.required)) {
    lines.push(
      `        if (params.path?.['${p.name}'] === undefined) throw new Error('Missing required path param: ${p.name}')`,
    )
  }
  for (const p of ep.queryParams.filter((x) => x.required)) {
    lines.push(
      `        if (params.query?.['${p.name}'] === undefined) throw new Error('Missing required query param: ${p.name}')`,
    )
  }
  if (ep.body?.required) {
    lines.push(`        if (!params.body) throw new Error('Missing required request body')`)
  }
  return lines.join('\n')
}

function genOperation(ep: Endpoint): string {
  const urlExpr = buildUrlExpr(ep.path)
  const requestCode = buildRequestCode(ep)
  const validations = buildValidations(ep)

  return `
  cmd
    .command('${ep.operationId}')
    .description(${JSON.stringify(ep.summary ?? ep.operationId)})
    .argument('[params]', 'JSON: {"path":{...},"query":{...},"body":{...}} or @file.json')
    .option('--output <format>', 'output format: json|table|raw', 'table')
    .option('--verbose', 'show request details')
    .action(async (paramsArg, opts) => {
      try {
        const params = parseParams(paramsArg)
${validations}
        const client = createClient(!!opts.verbose)
        const url = ${urlExpr}
        ${requestCode}
        printResponse(res.data, opts.output)
      } catch (err) {
        if (err.response) {
          printError(JSON.stringify(err.response.data), err.response.status)
        } else {
          printError(err.message)
        }
        process.exit(1)
      }
    })`
}

export function genTagCommand(tag: string, endpoints: Endpoint[]): string {
  const operations = endpoints.map((ep) => genOperation(ep)).join('\n')
  const safeName = toSafeTagName(tag)
  const fnName = toSafeFunctionName(tag)

  return `import { Command } from 'commander'
import { createClient } from '../lib/client.js'
import { printResponse, printError } from '../utils/output.js'
import fs from 'fs'

function parseParams(arg) {
  if (!arg) return {}
  if (arg.startsWith('@')) {
    const content = fs.readFileSync(arg.slice(1), 'utf-8')
    return JSON.parse(content)
  }
  return JSON.parse(arg)
}

export function create${fnName}Command() {
  const cmd = new Command('${safeName}').description(${JSON.stringify(tag + ' operations')})
${operations}

  return cmd
}
`
}
