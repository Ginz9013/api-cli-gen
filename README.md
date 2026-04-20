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
# Install globally
npm install -g api-cli-gen

# Or use directly with npx (no installation needed)
npx api-cli-gen generate <spec> --name <cli-name>
```

---

## Quick Start

```bash
# Using npx (one-shot, no global install)
npx api-cli-gen generate https://petstore3.swagger.io/api/v3/openapi.json --name petstore

# Or with global install
api-cli-gen generate ./petstore.json --name petstore

# Preview commands that would be generated (no files written)
api-cli-gen preview https://petstore3.swagger.io/api/v3/openapi.json
```

Once generated, the CLI is placed in `./<cli-name>/`:

```bash
cd petstore

petstore config set base-url https://petstore3.swagger.io
petstore config set auth bearer MY_TOKEN
petstore list
petstore pet getPetById '{"path":{"petId":1}}'
```

Or run without installing globally:

```bash
node petstore/dist/index.js --help
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
  -o, --output <dir>    Output directory (default: ./<cli-name>)
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

# Set authentication (multiple auths can coexist — see "Authentication" below)
<cli> config set auth bearer <token>
<cli> config set auth token <token>                                # raw token, no "Bearer" prefix
<cli> config set auth apikey <key>                                 # uses spec-derived defaults
<cli> config set auth apikey <key> --in header --header X-API-Key
<cli> config set auth apikey <key> --in query  --header api_key
<cli> config set auth basic <username> <password>
<cli> config set auth oauth2 <clientId> <clientSecret>             # only emitted when spec declares a clientCredentials flow

# View current config (tokens are masked, all stored auths listed)
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

Four auth types are always available in the generated CLI, regardless of what the spec's `securitySchemes` declares. A fifth (`oauth2`) is only emitted when the spec declares a `clientCredentials` flow.

| Command | Sends |
|---------|-------|
| `auth bearer <token>` | `Authorization: Bearer <token>` |
| `auth token <token>` | `Authorization: <token>` (no prefix) |
| `auth apikey <key> [--in header\|query] [--header <name>]` | Sends `<name>: <key>` in the chosen location. Defaults derived from the spec. |
| `auth basic <user> <pass>` | `Authorization: Basic <base64>` |
| `auth oauth2 <clientId> <clientSecret> [--scope <scope>]` | POSTs `grant_type=client_credentials` to the spec's tokenUrl and stores the returned access_token as a Bearer. |

### Multiple authentications

Since 0.2.0, `config.auths` is a list and multiple auth entries coexist. This is useful when an API needs, say, a tenant `X-API-Key` header **plus** a user Bearer token. Rules:

- Setting `bearer` / `token` / `basic` replaces any existing entry of the same type.
- Setting `apikey` is keyed on `(inQuery, headerName)` — you can store multiple apikeys as long as their name/location differ.
- All stored auths are applied to every request in order. If two entries write the same header (e.g. `bearer` + `basic`), the later one wins.
- Legacy single-auth `config.json` from pre-0.2.0 is auto-migrated on read.
- `config reset` clears everything; there is no per-entry removal.

### Spec-driven hints

If the spec declares `securitySchemes`, `config show` prints a one-line hint of what that API expects. For OAuth2 without a `clientCredentials` flow, the hint shows the `tokenUrl` and points you at `auth bearer <token>` (fetch the token externally).

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
