# api-cli-gen

**輸入一份 OpenAPI 規格，幾秒內產生可直接使用的 API CLI 工具。**

[English](./README.md) | [繁體中文](#)

---

## 專案概述

`api-cli-gen` 是一個 TypeScript CLI 工具，接受一份 OpenAPI 規格文件（本地檔案或遠端 URL），自動產生一個可直接使用的 API CLI 工具專案，包含設定管理、認證、列出所有 endpoint，以及依規格動態產生的 API 指令。

---

## 安裝

```bash
npm install -g api-cli-gen
```

---

## 快速開始

```bash
# 從本地 spec 產生
api-cli-gen generate ./petstore.json --name petstore

# 從遠端 URL 產生
api-cli-gen generate https://petstore3.swagger.io/api/v3/openapi.json --name petstore

# 預覽會產生哪些指令（不實際寫入檔案）
api-cli-gen preview https://petstore3.swagger.io/api/v3/openapi.json
```

產生完成後，直接使用：

```bash
cd generated/petstore

petstore config set base-url https://petstore3.swagger.io
petstore config set auth bearer MY_TOKEN
petstore list
petstore pet getPetById '{"path":{"petId":1}}'
```

---

## Generator 指令

### `generate <spec>`

從 OpenAPI spec 產生完整 CLI 專案，並自動安裝依賴、編譯。

```bash
api-cli-gen generate <spec> [options]

Arguments:
  spec                  本地 .json / .yaml 檔案路徑，或遠端 URL

Options:
  -o, --output <dir>    輸出目錄（預設：./generated/<cli-name>）
  -n, --name <name>     CLI binary 名稱（預設：從 spec info.title 推導）
```

### `preview <spec>`

解析 spec 並列出所有會產生的指令，不寫入任何檔案。

```bash
api-cli-gen preview <spec> [options]

Options:
  -n, --name <name>     CLI binary 名稱
```

### `update <spec>`

對既有的產生目錄重新產生（覆蓋 src 原始碼、重新編譯，保留 node_modules）。

```bash
api-cli-gen update <spec> [options]

Options:
  -o, --output <dir>    輸出目錄
  -n, --name <name>     CLI binary 名稱
```

---

## 產生的 CLI 使用說明

### 設定管理

```bash
# 設定 API base URL
<cli> config set base-url https://api.example.com

# 設定認證（四種方式）
<cli> config set auth bearer <token>
<cli> config set auth token <token>           # 不含 Bearer 前綴的原始 token
<cli> config set auth apikey <key>            # 預設使用 X-API-Key header
<cli> config set auth apikey <key> --header X-Custom-Header
<cli> config set auth basic <username> <password>

# 查看目前設定（token 遮蔽顯示）
<cli> config show

# 清除所有設定
<cli> config reset
```

> 設定儲存於 `~/.config/<cli-name>/config.json`。

### 列出所有 Endpoint

```bash
<cli> list                    # 列出所有 API（依 tag 分組）
<cli> list --tag pet          # 過濾特定 tag
<cli> list --output json      # 輸出 JSON 格式
```

### 呼叫 API

所有 API 指令的參數統一以單一 JSON 字串傳入：

```
<cli> <tag> <operationId> '<json>' [options]
```

JSON 結構：

```json
{
  "path":  { "<paramName>": "<value>" },
  "query": { "<paramName>": "<value>" },
  "body":  { ... }
}
```

#### 範例

```bash
# 僅 path param
petstore pet getPetById '{"path":{"petId":1}}'

# 僅 query param
petstore pet findByStatus '{"query":{"status":"available"}}'

# 僅 request body
petstore pet addPet '{"body":{"name":"doggie","status":"available"}}'

# path + body 混合
petstore pet updatePet '{"path":{"petId":1},"body":{"name":"updated"}}'

# 從檔案讀取參數
petstore pet addPet @payload.json

# 無參數
petstore store getInventory '{}'
```

#### 輸出格式

```bash
<cli> <tag> <operationId> '{}' --output table    # 表格（預設）
<cli> <tag> <operationId> '{}' --output json     # JSON
<cli> <tag> <operationId> '{}' --output raw      # 原始字串
```

#### Verbose 模式

```bash
<cli> <tag> <operationId> '{}' --verbose
```

顯示實際送出的 HTTP 請求資訊：

```
[GET] https://api.example.com/api/rooms
Authorization: Bearer eyJhbGci***n6Yw
```

---

## 認證說明

產生的 CLI 無論 OpenAPI spec 的 `securitySchemes` 有無宣告，皆支援以下四種認證方式：

| 指令 | 傳送方式 |
|------|----------|
| `auth bearer <token>` | `Authorization: Bearer <token>` |
| `auth token <token>` | `Authorization: <token>`（無前綴） |
| `auth apikey <key>` | `X-API-Key: <key>`（header 或 query） |
| `auth basic <user> <pass>` | `Authorization: Basic <base64>` |

若 spec 有宣告 `securitySchemes`，執行 `config show` 時會顯示該 API 建議的認證方式。

---

## 支援的 OpenAPI 版本

- OpenAPI 3.0.x
- Swagger 2.0

支援本地 `.json` / `.yaml` 檔案，以及遠端 URL。

---

## 專案結構

```
api-cli-gen/
├── src/
│   ├── index.ts              ← CLI entry（generate / preview / update）
│   ├── parser/
│   │   ├── loader.ts         ← 從檔案 / URL 載入並 parse spec
│   │   └── analyzer.ts       ← 解析 paths、tags、params、security
│   ├── generator/
│   │   ├── index.ts          ← 統籌產生流程
│   │   ├── commands.ts       ← 產生動態 API commands 程式碼
│   │   ├── config.ts         ← 產生 config command 程式碼
│   │   ├── list.ts           ← 產生 list command 程式碼
│   │   └── project.ts        ← 寫出檔案、執行 npm install & build
│   └── templates/
│       ├── packageJson.ts
│       ├── tsconfig.ts
│       ├── buildScript.ts
│       ├── mainEntry.ts
│       ├── libConfig.ts
│       ├── libClient.ts
│       └── utilsOutput.ts
└── dist/                     ← 編譯輸出（npm 發佈內容）
```

---

## Tech Stack

### Generator 本體

| 項目 | 套件 |
|------|------|
| 語言 | TypeScript |
| CLI framework | `commander` |
| OpenAPI 解析 | `@apidevtools/swagger-parser` |
| YAML 解析 | `js-yaml` |
| 打包 | `tsup` |

### 產生的 CLI

| 項目 | 套件 |
|------|------|
| CLI framework | `commander` |
| HTTP | `axios` |
| 顏色輸出 | `chalk` |
| 打包 | `esbuild` |

---

## License

MIT
