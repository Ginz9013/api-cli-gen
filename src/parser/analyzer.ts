import type { OpenAPI, OpenAPIV3, OpenAPIV2 } from 'openapi-types'
import type { ParsedSpec, Endpoint, Param, BodySchema, SecurityScheme } from '../types.js'

function isV3(doc: OpenAPI.Document): doc is OpenAPIV3.Document {
  return 'openapi' in doc && typeof (doc as OpenAPIV3.Document).openapi === 'string'
}

export function analyzeSpec(doc: OpenAPI.Document): ParsedSpec {
  if (isV3(doc)) {
    return analyzeV3(doc)
  }
  return analyzeV2(doc as OpenAPIV2.Document)
}

// ── OpenAPI 3.x ──────────────────────────────────────────────────────────────

function analyzeV3(doc: OpenAPIV3.Document): ParsedSpec {
  const title = doc.info.title
  const version = doc.info.version
  const baseUrl = doc.servers?.[0]?.url

  const security = extractSecurityV3(doc)
  const endpoints: Endpoint[] = []
  const tagSet = new Set<string>()

  for (const [urlPath, pathItem] of Object.entries(doc.paths ?? {})) {
    if (!pathItem) continue

    const methods = ['get', 'post', 'put', 'patch', 'delete'] as const
    for (const method of methods) {
      const op = (pathItem as Record<string, unknown>)[method] as OpenAPIV3.OperationObject | undefined
      if (!op) continue

      const tag = op.tags?.[0] ?? 'default'
      tagSet.add(tag)

      const operationId =
        op.operationId ?? `${method}_${urlPath.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}`

      const allParams = [
        ...((pathItem.parameters ?? []) as OpenAPIV3.ParameterObject[]),
        ...((op.parameters ?? []) as OpenAPIV3.ParameterObject[]),
      ]

      const pathParams = allParams
        .filter((p) => p.in === 'path')
        .map((p) => paramFromV3(p, true))

      const queryParams = allParams
        .filter((p) => p.in === 'query')
        .map((p) => paramFromV3(p, false))

      const body = extractBodyV3(op.requestBody as OpenAPIV3.RequestBodyObject | undefined)

      endpoints.push({
        tag,
        operationId,
        method: method.toUpperCase() as Endpoint['method'],
        path: urlPath,
        summary: op.summary,
        pathParams,
        queryParams,
        body,
      })
    }
  }

  return { title, version, baseUrl, security, tags: Array.from(tagSet), endpoints }
}

function paramFromV3(p: OpenAPIV3.ParameterObject, defaultRequired: boolean): Param {
  const schema = (p.schema ?? {}) as Record<string, unknown>
  return {
    name: p.name,
    required: p.required ?? defaultRequired,
    type: (schema['type'] as string) ?? 'string',
    description: p.description,
    enum: schema['enum'] as string[] | undefined,
  }
}

function extractBodyV3(rb: OpenAPIV3.RequestBodyObject | undefined): BodySchema | undefined {
  if (!rb) return undefined
  const jsonContent = rb.content?.['application/json']
  if (!jsonContent) return undefined
  return {
    contentType: 'application/json',
    required: rb.required ?? false,
    schema: (jsonContent.schema as object) ?? {},
  }
}

function extractSecurityV3(doc: OpenAPIV3.Document): SecurityScheme[] {
  const schemes: SecurityScheme[] = []
  const components = doc.components?.securitySchemes
  if (!components) return schemes

  for (const [name, scheme] of Object.entries(components)) {
    const s = scheme as OpenAPIV3.SecuritySchemeObject
    if (s.type === 'http') {
      const httpScheme = (s as OpenAPIV3.HttpSecurityScheme).scheme
      if (httpScheme === 'bearer') schemes.push({ name, type: 'bearer' })
      else if (httpScheme === 'basic') schemes.push({ name, type: 'basic' })
    } else if (s.type === 'apiKey') {
      const ak = s as OpenAPIV3.ApiKeySecurityScheme
      schemes.push({ name, type: 'apikey', in: ak.in as SecurityScheme['in'], paramName: ak.name })
    } else if (s.type === 'oauth2') {
      const oauth = s as OpenAPIV3.OAuth2SecurityScheme
      const flows = oauth.flows ?? {}
      const clientCredentialsUrl = flows.clientCredentials?.tokenUrl
      const tokenUrl =
        clientCredentialsUrl ||
        flows.authorizationCode?.tokenUrl ||
        flows.password?.tokenUrl ||
        flows.implicit?.authorizationUrl
      schemes.push({ name, type: 'oauth2', tokenUrl, clientCredentialsUrl })
    }
  }
  return schemes
}

function extractSecurityV2(doc: OpenAPIV2.Document): SecurityScheme[] {
  const schemes: SecurityScheme[] = []
  const definitions = doc.securityDefinitions
  if (!definitions) return schemes

  for (const [name, def] of Object.entries(definitions)) {
    const s = def as Record<string, unknown>
    if (s['type'] === 'basic') {
      schemes.push({ name, type: 'basic' })
    } else if (s['type'] === 'apiKey') {
      schemes.push({
        name,
        type: 'apikey',
        in: s['in'] as SecurityScheme['in'],
        paramName: s['name'] as string | undefined,
      })
    } else if (s['type'] === 'oauth2') {
      const flow = s['flow'] as string | undefined
      const tokenUrl = (s['tokenUrl'] as string | undefined) || (s['authorizationUrl'] as string | undefined)
      const clientCredentialsUrl = flow === 'application' ? (s['tokenUrl'] as string | undefined) : undefined
      schemes.push({ name, type: 'oauth2', tokenUrl, clientCredentialsUrl })
    }
  }
  return schemes
}

// ── Swagger 2.x ──────────────────────────────────────────────────────────────

function analyzeV2(doc: OpenAPIV2.Document): ParsedSpec {
  const title = doc.info.title
  const version = doc.info.version
  const scheme = doc.schemes?.[0] ?? 'https'
  const baseUrl = doc.host ? `${scheme}://${doc.host}${doc.basePath ?? ''}` : undefined

  const endpoints: Endpoint[] = []
  const tagSet = new Set<string>()

  for (const [urlPath, pathItem] of Object.entries(doc.paths ?? {})) {
    if (!pathItem) continue

    const methods = ['get', 'post', 'put', 'patch', 'delete'] as const
    for (const method of methods) {
      const op = (pathItem as Record<string, unknown>)[method] as OpenAPIV2.OperationObject | undefined
      if (!op) continue

      const tag = op.tags?.[0] ?? 'default'
      tagSet.add(tag)

      const operationId =
        op.operationId ?? `${method}_${urlPath.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}`

      const params = (op.parameters ?? []) as Array<Record<string, unknown>>

      const pathParams: Param[] = params
        .filter((p) => p['in'] === 'path')
        .map((p) => ({
          name: p['name'] as string,
          required: (p['required'] as boolean) ?? true,
          type: (p['type'] as string) ?? 'string',
          description: p['description'] as string | undefined,
          enum: p['enum'] as string[] | undefined,
        }))

      const queryParams: Param[] = params
        .filter((p) => p['in'] === 'query')
        .map((p) => ({
          name: p['name'] as string,
          required: (p['required'] as boolean) ?? false,
          type: (p['type'] as string) ?? 'string',
          description: p['description'] as string | undefined,
          enum: p['enum'] as string[] | undefined,
        }))

      const bodyParam = params.find((p) => p['in'] === 'body')
      const body: BodySchema | undefined = bodyParam
        ? {
            contentType: 'application/json',
            required: (bodyParam['required'] as boolean) ?? false,
            schema: (bodyParam['schema'] as object) ?? {},
          }
        : undefined

      endpoints.push({
        tag,
        operationId,
        method: method.toUpperCase() as Endpoint['method'],
        path: urlPath,
        summary: op.summary,
        pathParams,
        queryParams,
        body,
      })
    }
  }

  const security = extractSecurityV2(doc)
  return { title, version, baseUrl, security, tags: Array.from(tagSet), endpoints }
}
