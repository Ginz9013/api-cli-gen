import fs from 'fs'
import path from 'path'
import axios from 'axios'
import yaml from 'js-yaml'
import SwaggerParser from '@apidevtools/swagger-parser'
import type { OpenAPI } from 'openapi-types'

export async function loadSpec(source: string): Promise<OpenAPI.Document> {
  let raw: string

  if (source.startsWith('http://') || source.startsWith('https://')) {
    const res = await axios.get<unknown>(source, { responseType: 'text' })
    raw = typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
  } else {
    const abs = path.resolve(process.cwd(), source)
    if (!fs.existsSync(abs)) {
      throw new Error(`File not found: ${abs}`)
    }
    raw = fs.readFileSync(abs, 'utf-8')
  }

  const ext = source.split('?')[0].split('.').pop()?.toLowerCase()
  let parsed: OpenAPI.Document

  if (ext === 'yaml' || ext === 'yml') {
    parsed = yaml.load(raw) as OpenAPI.Document
  } else {
    parsed = JSON.parse(raw) as OpenAPI.Document
  }

  // Resolve all $ref references
  const api = await SwaggerParser.dereference(parsed as Parameters<typeof SwaggerParser.dereference>[0])
  return api as OpenAPI.Document
}
