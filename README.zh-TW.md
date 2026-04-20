# api-cli-gen

**輸入一份 OpenAPI 規格，幾秒內產生可直接使用的 API CLI 工具。**

[English](./README.md) | [繁體中文](#)

---

## 專案概述

`api-cli-gen` 是一個 TypeScript CLI 工具，接受一份 OpenAPI 規格文件（本地檔案或遠端 URL），自動產生一個可直接使用的 API CLI 工具專案，包含設定管理、認證、列出所有 endpoint，以及依規格動態產生的 API 指令。

---

## 安裝

```bash
# 全域安裝
npm install -g api-cli-gen

# 或直接使用 npx（免安裝，用完即丟）
npx api-cli-gen generate <spec> --name <cli-name>
```

---

## 快速開始

```bash
# 使用 npx（免全域安裝）
npx api-cli-gen generate https://petstore3.swagger.io/api/v3/openapi.json --name petstore

# 或全域安裝後使用
api-cli-gen generate ./petstore.json --name petstore

# 預覽會產生哪些指令（不實際寫入檔案）
api-cli-gen preview https://petstore3.swagger.io/api/v3/openapi.json
```

產生完成後，CLI 會放在 `./<cli-name>/`：

```bash
cd petstore

petstore config set base-url https://petstore3.swagger.io
petstore config set auth bearer MY_TOKEN
petstore list
petstore pet getPetById '{"path":{"petId":1}}'
```

也可以不全域安裝，直接執行：

```bash
node petstore/dist/index.js --help
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
  -o, --output <dir>    輸出目錄（預設：./<cli-name>）
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

# 設定認證（多組可並存，詳見下方「認證說明」）
<cli> config set auth bearer <token>
<cli> config set auth token <token>                                # 不含 Bearer 前綴的原始 token
<cli> config set auth apikey <key>                                 # 使用 spec 推導的預設值
<cli> config set auth apikey <key> --in header --header X-API-Key
<cli> config set auth apikey <key> --in query  --header api_key
<cli> config set auth basic <username> <password>
<cli> config set auth oauth2 <clientId> <clientSecret>             # spec 宣告 clientCredentials flow 時才會出現

# 查看目前設定（token 遮蔽顯示、列出所有已存 auth）
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

產生的 CLI 無論 OpenAPI spec 的 `securitySchemes` 有無宣告，皆支援以下四種認證方式；第五種 `oauth2` 只有當 spec 宣告 `clientCredentials` flow 時才會生成。

| 指令 | 傳送方式 |
|------|----------|
| `auth bearer <token>` | `Authorization: Bearer <token>` |
| `auth token <token>` | `Authorization: <token>`（無前綴） |
| `auth apikey <key> [--in header\|query] [--header <name>]` | 以 `<name>: <key>` 放在指定位置；預設值從 spec 推導 |
| `auth basic <user> <pass>` | `Authorization: Basic <base64>` |
| `auth oauth2 <clientId> <clientSecret> [--scope <scope>]` | 對 spec 的 tokenUrl 發 `POST grant_type=client_credentials`，取回 access_token 後存成 Bearer |

### 多組認證並存

從 0.2.0 起 `config.auths` 變成陣列，可以同時存多個認證。例如 API 要求「租戶 `X-API-Key` header」加上「使用者 Bearer token」的組合。規則：

- 設 `bearer` / `token` / `basic` 會取代同類型的既有項目。
- 設 `apikey` 依 `(inQuery, headerName)` 去重，只要名稱/位置不同就能同時存多組。
- 每次 request 會依序套用所有已存 auth；若兩個項目寫同一個 header（例如 `bearer` + `basic`），後者覆蓋前者。
- 0.2.0 之前的單一 auth 格式 `config.json` 在讀取時會自動遷移。
- `config reset` 清光全部；沒有單獨移除某個 auth 的指令。

### Spec 提示

若 spec 有宣告 `securitySchemes`，`config show` 會印一行提示該 API 預期的認證方式。OAuth2 沒有 `clientCredentials` flow 時，提示會印出 `tokenUrl` 並建議用 `auth bearer <token>`（使用者自己先用其他工具拿到 token）。

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
