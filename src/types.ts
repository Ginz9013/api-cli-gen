export interface ParsedSpec {
  title: string
  version: string
  baseUrl?: string
  security: SecurityScheme[]
  tags: string[]
  endpoints: Endpoint[]
}

export interface Endpoint {
  tag: string
  operationId: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  summary?: string
  pathParams: Param[]
  queryParams: Param[]
  body?: BodySchema
}

export interface Param {
  name: string
  required: boolean
  type: string
  description?: string
  enum?: string[]
}

export interface BodySchema {
  contentType: string
  required: boolean
  schema: object
}

export interface SecurityScheme {
  name: string
  type: 'bearer' | 'apikey' | 'basic' | 'oauth2'
  in?: 'header' | 'query' | 'cookie'
  paramName?: string
}

export interface GenerateOptions {
  spec: string
  output?: string
  name?: string
  update?: boolean
}
