# api-cli-gen — 專案規格書

## 專案概述

`api-cli-gen` 是一個 TypeScript CLI 工具，接受一份 OpenAPI 規格文件（本地檔案或遠端 URL），自動產生一個可直接使用的 API CLI 工具專案。

產生的 CLI 工具包含：設定管理（base URL、認證）、列出所有 API、以及對應 OpenAPI spec 動態產生的指令。

---

## 使用流程（目標 UX）

```bash
# 安裝 generator
npm install -g api-cli-gen

# 從本地 spec 產生，指定 CLI 名稱為 petstore
api-cli-gen generate ./petstore.json --output ./petstore-cli --name petstore

# 從 URL 產生
api-cli-gen generate https://petstore3.swagger.io/api/v3/openapi.json --output ./petstore-cli --name petstore

# 不指定 --name 時，預設使用 OpenAPI spec 的 info.title（轉為 kebab-case）
api-cli-gen generate ./petstore.json --output ./petstore-cli

# 預覽會產生哪些指令（不實際 generate）
api-cli-gen preview ./petstore.json --name petstore

# 重新產生（spec 更新後）
api-cli-gen update ./petstore.json --output ./petstore-cli

# ---- 使用產生的 CLI（name=petstore）----
cd petstore-cli

petstore config set base-url https://petstore3.swagger.io
petstore config set auth bearer MY_TOKEN
petstore config show
petstore config reset

petstore list                                                     # 列出所有 API endpoints
petstore pet getPetById '{"path":{"petId":1}}'                    # path param
petstore pet addPet '{"body":{"name":"doggie","status":"available"}}'  # request body
petstore pet findByStatus '{"query":{"status":"available"}}'      # query param
petstore pet updatePet '{"path":{"petId":1},"body":{"name":"doggie"}}'  # 混合
petstore pet addPet @payload.json                                  # 從檔案讀取
petstore store getInventory '{}'                                   # 無參數時傳空物件
```

---

## 功能需求

### Generator（`api-cli-gen` 本體）

| # | 功能 |
|---|------|
| G1 | `generate` 指令：接受 spec 來源 + 輸出目錄，產生完整 CLI 專案並自動 build |
| G2 | `preview` 指令：解析 spec，列出會產生的所有指令，不寫入任何檔案 |
| G3 | `update` 指令：對既有產生目錄重新 generate（覆蓋 src，保留 config） |
| G4 | 輸入支援本地 `.json` / `.yaml` 檔案 |
| G5 | 輸入支援遠端 URL（自動 fetch） |
| G6 | 支援 OpenAPI 3.0.x 及 Swagger 2.0 |
| G7 | 解析完成後自動執行 `npm install && build`，產出可直接執行的 bundle |
| G8 | `--name <cli-name>` 選項：指定產生的 CLI binary 名稱（e.g. `--name petstore` → `petstore list`） |
| G9 | 未指定 `--name` 時，預設取 OpenAPI `info.title` 並轉為 kebab-case（e.g. `Petstore API` → `petstore-api`） |

### 產生的 CLI — config 指令

| # | 指令 | 說明 |
|---|------|------|
| C1 | `config set base-url <url>` | 設定 API base URL |
| C2 | `config set auth bearer <token>` | 設定 Bearer token 認證 |
| C3 | `config set auth apikey <key> [--header X-API-Key]` | 設定 API Key 認證 |
| C4 | `config set auth basic <user> <pass>` | 設定 Basic Auth |
| C5 | `config show` | 顯示目前設定（token 遮蔽顯示） |
| C6 | `config reset` | 清除所有設定 |

### 產生的 CLI — list 指令

| # | 功能 |
|---|------|
| L1 | 列出所有 endpoint（method、path、operationId、summary） |
| L2 | 依 tag 分組顯示 |
| L3 | 支援 `--tag <name>` 過濾特定 tag |
| L4 | 支援 `--output json` 輸出 JSON 格式 |

### 產生的 CLI — 動態 API 指令

| # | 功能 |
|---|------|
| A1 | 依 OpenAPI tags 產生 command group（e.g. `petstore pet ...`） |
| A2 | 依 operationId 產生 subcommand（e.g. `petstore pet getPetById`） |
| A3 | 所有參數統一以單一 JSON positional argument 傳入（見下方 JSON 輸入格式） |
| A4 | JSON 輸入支援 `path`、`query`、`body` 三個 top-level key |
| A5 | JSON 輸入支援 `@file.json` 語法，從檔案讀取 |
| A6 | 無參數的 endpoint 傳入 `'{}'` 或省略 argument |
| A7 | 自動帶入 config 中的 base-url 與 auth header |
| A8 | `--output json\|table\|raw` 控制回應格式（預設 table） |
| A9 | `--verbose` 顯示實際送出的 HTTP request（URL、headers、body） |
| A10 | HTTP 錯誤時顯示 status code 與 response body |
| A11 | 自動從 OpenAPI `securitySchemes` 偵測 auth 類型 |

### JSON 輸入格式規範

所有 API 指令的參數統一以單一 JSON 字串傳入：

```
petstore <tag> <operationId> '<json>' [--output json|table|raw] [--verbose]
```

JSON 結構：

```json
{
  "path":  { "<paramName>": "<value>" },   // path parameters，對應 /pet/{petId}
  "query": { "<paramName>": "<value>" },   // query parameters
  "body":  { ... }                         // request body（application/json）
}
```

範例：

```bash
# 僅 path param
petstore pet getPetById '{"path":{"petId":1}}'

# 僅 query params
petstore pet findByStatus '{"query":{"status":"available"}}'

# 僅 body
petstore pet addPet '{"body":{"name":"doggie","status":"available"}}'

# path + body 混合
petstore pet updatePet '{"path":{"petId":1},"body":{"name":"updated"}}'

# 從檔案讀取（整個 JSON 結構）
petstore pet addPet @payload.json

# 無參數
petstore store getInventory '{}'
```

---

## 功能清單（Checklist）

### Phase 1：Generator 核心

- [ ] CLI entry point（`api-cli-gen generate / preview / update`）
- [ ] `--name <cli-name>` 選項解析，轉為合法的 binary 名稱
- [ ] 未指定 `--name` 時自動從 `info.title` 推導（kebab-case）
- [ ] 從本地檔案讀取 spec（json / yaml）
- [ ] 從 URL fetch spec
- [ ] 解析並驗證 OpenAPI spec（$ref resolve）
- [ ] 產生 config command 原始碼
- [ ] 產生 list command 原始碼
- [ ] 產生動態 API commands 原始碼（依 path / tag / operationId）
- [ ] 產生 package.json、tsconfig.json、entry 檔案
- [ ] 將所有檔案寫出到指定目錄
- [ ] 自動執行 `npm install && build`

### Phase 2：產生的 CLI 品質

- [ ] Bearer token 認證支援
- [ ] API Key 認證（header / query）支援
- [ ] Basic Auth 支援
- [ ] 設定持久化（base_url、auth 儲存至本地）
- [ ] Table 輸出格式
- [ ] JSON 輸出格式
- [ ] JSON 輸入解析（`path` / `query` / `body` key 分派）
- [ ] `@file.json` 語法支援（讀檔並 parse）
- [ ] required 欄位驗證（缺少時顯示友善錯誤）
- [ ] HTTP 錯誤處理與友善提示
- [ ] `--verbose` 模式

### Phase 3：細節優化

- [ ] `preview` 指令完整實作
- [ ] `update` 指令完整實作
- [ ] `securitySchemes` 自動偵測
- [ ] `--schema` 顯示 response schema
- [ ] 無 tag 的 endpoint 歸類至 `default` group
- [ ] 互動式 config 設定（`config set` 無參數時進入提示）

---

## Tech Stack

### Generator 本體

| 項目 | 套件 | 說明 |
|------|------|------|
| 語言 | TypeScript | 型別安全，處理 OpenAPI schema 更可靠 |
| CLI framework | `commander` | 成熟、輕量、支援 subcommand |
| OpenAPI 解析 | `@readme/openapi-parser` | 支援 $ref resolve、2.0 / 3.0 驗證 |
| YAML 解析 | `js-yaml` | 支援 yaml 格式 spec |
| HTTP（fetch URL） | `axios` | 統一 HTTP 處理 |
| 程式碼格式化 | `prettier` | 產生的程式碼自動格式化 |
| 打包 | `tsup` | 零設定，輸出 ESM + CJS bundle |

### 產生的 CLI template

| 項目 | 套件 | 說明 |
|------|------|------|
| CLI framework | `commander` | 動態 addCommand / addArgument |
| 設定儲存 | `conf` | XDG-compliant，OS-aware 本地設定 |
| HTTP 呼叫 | `axios` | interceptor 掛 auth header |
| Table 輸出 | `cli-table3` | ASCII table 顯示 |
| Terminal 顏色 | `chalk` | 錯誤 / 成功 / 提示顏色 |
| 互動輸入 | `@inquirer/prompts` | config set 互動式輸入 |
| 打包 | `esbuild` | 快速產生單一 standalone bundle |

### 開發工具

| 項目 | 套件 |
|------|------|
| Linter | `eslint` + `@typescript-eslint` |
| Formatter | `prettier` |
| Test | `vitest` |
| Type check | `tsc --noEmit` |

---

## 專案目錄結構

```
api-cli-gen/                        ← Generator 本體（此 repo）
├── src/
│   ├── index.ts                    ← CLI entry（generate / preview / update）
│   ├── parser/
│   │   ├── loader.ts               ← 從檔案 / URL 載入並 parse spec
│   │   └── analyzer.ts             ← 解析 paths、tags、params、security
│   ├── generator/
│   │   ├── index.ts                ← 統籌產生流程
│   │   ├── commands.ts             ← 產生動態 API commands 程式碼
│   │   ├── config.ts               ← 產生 config command 程式碼
│   │   ├── list.ts                 ← 產生 list command 程式碼
│   │   └── project.ts              ← 寫出檔案、執行 npm install & build
│   └── templates/
│       ├── packageJson.ts          ← package.json template（bin 欄位使用 --name 值）
│       ├── tsconfig.ts             ← tsconfig.json template
│       └── main.ts.ts              ← 產生的 CLI entry template
├── dist/                           ← tsup 編譯輸出（發佈至 npm）
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── spec.md                         ← 本檔案
```

### 產生物目錄結構（以 petstore-cli 為例）

```
petstore-cli/                       ← generator 產生的 CLI 專案
├── src/
│   ├── index.ts                    ← CLI entry，動態載入所有 commands
│   ├── commands/
│   │   ├── config.ts               ← config 指令
│   │   ├── list.ts                 ← list 指令
│   │   └── pet.ts                  ← tag=pet 的所有 API 指令
│   │   └── store.ts                ← tag=store 的所有 API 指令
│   ├── lib/
│   │   ├── client.ts               ← axios instance + auth interceptor
│   │   └── config.ts               ← conf 設定讀寫
│   └── utils/
│       └── output.ts               ← table / json / raw 格式輸出
├── dist/
│   └── cli.js                      ← esbuild 打包的單一執行檔
├── package.json
└── tsconfig.json
```

---

## 資料流

```
輸入（檔案 / URL）
    ↓
loader.ts         載入 & parse YAML/JSON
    ↓
analyzer.ts       整理成內部資料結構（tags、endpoints、params、security）
    ↓
generator/        依資料結構產生各 command 的 TypeScript 原始碼
    ↓
project.ts        寫出所有檔案到目標目錄
    ↓
npm install       安裝 template 依賴
    ↓
esbuild bundle    產生 dist/cli.js
    ↓
完成，可直接執行
```

---

## 內部資料結構（analyzer 輸出）

```typescript
interface ParsedSpec {
  title: string
  version: string
  baseUrl?: string
  security: SecurityScheme[]
  tags: string[]
  endpoints: Endpoint[]
}

interface Endpoint {
  tag: string           // 分組用，無 tag 時為 "default"
  operationId: string   // command 名稱
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string          // e.g. /pet/{petId}
  summary?: string
  pathParams: Param[]
  queryParams: Param[]
  body?: BodySchema
  security?: string[]
}

interface Param {
  name: string
  required: boolean
  type: string          // string | number | boolean | array
  description?: string
  enum?: string[]
}

interface BodySchema {
  contentType: string   // application/json 等
  required: boolean
  schema: object        // raw JSON Schema
}

interface SecurityScheme {
  name: string
  type: 'bearer' | 'apikey' | 'basic' | 'oauth2'
  in?: 'header' | 'query' | 'cookie'
  paramName?: string    // e.g. X-API-Key
}
```

---

## 版本規劃

| 版本 | 內容 |
|------|------|
| v0.1 | Phase 1：generator 核心，可產生基本可執行的 CLI |
| v0.2 | Phase 2：完整 auth 支援、table/json 輸出、verbose |
| v0.3 | Phase 3：preview、update、securitySchemes 偵測 |
| v1.0 | 發佈至 npm，完整文件 |
