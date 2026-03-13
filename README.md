# api-cli-gen

**Generate a fully functional API CLI from any OpenAPI spec in seconds.**

[English](#) | [繁體中文](./README.zh-TW.md)

[![npm version](https://img.shields.io/npm/v/api-cli-gen)](https://www.npmjs.com/package/api-cli-gen)
[![license](https://img.shields.io/npm/l/api-cli-gen)](./LICENSE)

---

## Overview

`api-cli-gen` is a TypeScript CLI tool that takes an OpenAPI spec (local file or remote URL) and generates a ready-to-use API CLI project — complete with config management, authentication, endpoint listing, and dynamically generated commands per tag/operation.

---

## Installation

```bash
npm install -g api-cli-gen
```

---

## Quick Start

```bash
# Generate from a local spec file
api-cli-gen generate ./petstore.json --name petstore

# Generate from a remote URL
api-cli-gen generate https://petstore3.swagger.io/api/v3/openapi.json --name petstore

# Preview commands that would be generated (no files written)
api-cli-gen preview https://petstore3.swagger.io/api/v3/openapi.json
```

Once generated, use the CLI directly:

```bash
cd generated/petstore

petstore config set base-url https://petstore3.swagger.io
petstore config set auth bearer MY_TOKEN
petstore list
petstore pet getPetById '{"path":{"petId":1}}'
```

---

## Generator Commands

### `generate <spec>`

Generate a full CLI project from an OpenAPI spec. Automatically installs dependencies and builds.

```bash
api-cli-gen generate <spec> [options]

Arguments:
  spec                  Path to a local .json / .yaml file, or a remote URL

Options:
  -o, --output <dir>    Output directory (default: ./generated/<cli-name>)
  -n, --name <name>     CLI binary name (default: derived from spec info.title)
```

### `preview <spec>`

Parse the spec and list all commands that would be generated — without writing any files.

```bash
api-cli-gen preview <spec> [options]

Options:
  -n, --name <name>     CLI binary name
```

### `update <spec>`

Re-generate an existing CLI project (overwrites source files and rebuilds, preserves node_modules).

```bash
api-cli-gen update <spec> [options]

Options:
  -o, --output <dir>    Output directory
  -n, --name <name>     CLI binary name
```

---

## Generated CLI Usage

### Config Management

```bash
# Set the API base URL
<cli> config set base-url https://api.example.com

# Set authentication
<cli> config set auth bearer <token>
<cli> config set auth token <token>           # raw token, no "Bearer" prefix
<cli> config set auth apikey <key>            # default: X-API-Key header
<cli> config set auth apikey <key> --header X-Custom-Header
<cli> config set auth basic <username> <password>

# View current config (tokens are masked)
<cli> config show

# Clear all config
<cli> config reset
```

> Config is stored at `~/.config/<cli-name>/config.json`.

### List Endpoints

```bash
<cli> list                    # List all endpoints grouped by tag
<cli> list --tag pet          # Filter by tag
<cli> list --output json      # Output as JSON
```

### Calling APIs

All API commands accept a single JSON argument:

```
<cli> <tag> <operationId> '<json>' [options]
```

JSON structure:

```json
{
  "path":  { "<paramName>": "<value>" },
  "query": { "<paramName>": "<value>" },
  "body":  { ... }
}
```

#### Examples

```bash
# Path parameter
petstore pet getPetById '{"path":{"petId":1}}'

# Query parameter
petstore pet findByStatus '{"query":{"status":"available"}}'

# Request body
petstore pet addPet '{"body":{"name":"doggie","status":"available"}}'

# Mixed: path + body
petstore pet updatePet '{"path":{"petId":1},"body":{"name":"updated"}}'

# Load params from a file
petstore pet addPet @payload.json

# No params
petstore store getInventory '{}'
```

#### Output Format

```bash
<cli> <tag> <operationId> '{}' --output table    # table (default)
<cli> <tag> <operationId> '{}' --output json     # JSON
<cli> <tag> <operationId> '{}' --output raw      # raw string
```

#### Verbose Mode

```bash
<cli> <tag> <operationId> '{}' --verbose
```

Prints the actual HTTP request being sent:

```
[GET] https://api.example.com/api/rooms
Authorization: Bearer eyJhbGci***n6Yw
```

---

## Authentication

All four auth types are always available in the generated CLI, regardless of what is declared in the spec's `securitySchemes`:

| Command | Sends |
|---------|-------|
| `auth bearer <token>` | `Authorization: Bearer <token>` |
| `auth token <token>` | `Authorization: <token>` (no prefix) |
| `auth apikey <key>` | `X-API-Key: <key>` (header or query param) |
| `auth basic <user> <pass>` | `Authorization: Basic <base64>` |

If the spec declares `securitySchemes`, `config show` will display the recommended auth method for that API.

---

## Supported OpenAPI Versions

- OpenAPI 3.0.x
- Swagger 2.0

Accepts local `.json` / `.yaml` files and remote URLs.

---

## Project Structure

```
api-cli-gen/
├── src/
│   ├── index.ts              ← CLI entry (generate / preview / update)
│   ├── parser/
│   │   ├── loader.ts         ← Load and parse spec from file or URL
│   │   └── analyzer.ts       ← Extract paths, tags, params, security
│   ├── generator/
│   │   ├── index.ts          ← Orchestrate generation flow
│   │   ├── commands.ts       ← Generate dynamic API command source
│   │   ├── config.ts         ← Generate config command source
│   │   ├── list.ts           ← Generate list command source
│   │   └── project.ts        ← Write files, run npm install & build
│   └── templates/
│       ├── packageJson.ts
│       ├── tsconfig.ts
│       ├── buildScript.ts
│       ├── mainEntry.ts
│       ├── libConfig.ts
│       ├── libClient.ts
│       └── utilsOutput.ts
└── dist/                     ← Compiled output (published to npm)
```

---

## Tech Stack

### Generator

| | Package |
|-|---------|
| Language | TypeScript |
| CLI framework | `commander` |
| OpenAPI parser | `@apidevtools/swagger-parser` |
| YAML support | `js-yaml` |
| Bundler | `tsup` |

### Generated CLI

| | Package |
|-|---------|
| CLI framework | `commander` |
| HTTP client | `axios` |
| Terminal colors | `chalk` |
| Bundler | `esbuild` |

---

## License

MIT
