# Auth 相關 Issues

記錄目前 auth 判斷與 config 流程在實作上容易出錯、或彈性不足的地方。

---

## 背景：目前的 auth 流程

**產生階段** — [src/generator/config.ts](src/generator/config.ts) 固定產生四種 auth subcommand（`bearer` / `token` / `apikey` / `basic`），不論 spec 宣告什麼。spec 的 `securitySchemes` 只用來決定 `apikey` 指令的 `--header` 預設值與 `inQuery` 旗標。

**執行階段** — 使用者跑 `<cli> config set auth <type> ...` → [libConfig.ts](src/templates/libConfig.ts) `setAuth` 寫入 `~/.config/<cli-name>/config.json` → API 呼叫時 [libClient.ts](src/templates/libClient.ts) axios interceptor 依 `auth.type` 掛 header。

**Parse 階段** — [src/parser/analyzer.ts](src/parser/analyzer.ts) `extractSecurityV3` 只處理 OpenAPI 3.x，抽出 bearer / basic / apikey / oauth2 四類；Swagger 2.0 的 `analyzeV2` 完全沒抽 security。

---

## Issues

### ~~#1 `inQuery` 在產生階段寫死，使用者無法切換~~ ✅ Fixed

**位置：** [src/generator/config.ts](src/generator/config.ts)

**Fix：** 改成 runtime 選項 `--in <header|query>`，預設從 spec 推導（`apikeyScheme?.in === 'query' ? 'query' : 'header'`）。action 中檢核值，非 `header`/`query` 直接退出。

**新用法：**
```bash
<cli> config set auth apikey KEY --in query --header api_key
<cli> config set auth apikey KEY --in header --header X-API-Key
<cli> config set auth apikey KEY                 # 使用 spec 預設
```

---

### #2 apikey 預設 key 名前後不一致

**位置：**
- [src/generator/config.ts:8](src/generator/config.ts#L8)（生成時預設 header name）
- [src/templates/libClient.ts:18-22](src/templates/libClient.ts#L18-L22)（runtime fallback）

```ts
// generator：--header 預設值
const defaultHeader = apikeyScheme?.paramName ?? 'X-API-Key'

// interceptor：runtime fallback
if (auth.inQuery) {
  req.params = { ...req.params, [auth.headerName ?? 'api_key']: auth.key }
} else {
  req.headers[auth.headerName ?? 'X-API-Key'] = auth.key
}
```

**影響：** query 模式的 fallback 是 `'api_key'`，header 模式是 `'X-API-Key'`。理論上 `setAuth` 一定會寫入 `headerName`，fallback 不會被觸發，但兩個常數不一致會讓未來 refactor 時埋雷。

**建議方向：** 抽成單一常數，或移除不可達的 fallback。

---

### ~~#3 只能同時存一種 auth~~ ✅ Fixed

**位置：** [src/templates/libConfig.ts](src/templates/libConfig.ts) / [src/templates/libClient.ts](src/templates/libClient.ts) / [src/generator/config.ts](src/generator/config.ts)

**Fix：**
- `config.auth`（單一）→ `config.auths`（陣列）。
- `setAuth` 改用 `authKey` 合併：bearer / token / basic 依 type 去重（同類型後寫蓋前寫），apikey 依 `type + headerName + inQuery` 去重（允許同時存在多個不同 name/位置的 apikey）。
- Interceptor 迭代 `config.auths`，依序套用每一筆。
- 舊 `config.auth` 單一物件在 read 時自動遷移到 `config.auths`（下一次 write 時才會持久化到檔案）。
- `config show` 迭代印出全部 auths。

**已驗證情境：**
- bearer + 多個不同位置/名稱的 apikey 可同時存在
- 同 type / 同 apikey key 會取代不會重複
- 舊 config.json 自動 migrate

**已知限制：**
- `bearer` / `token` / `basic` 都寫入 `Authorization` header，同時存在時後者會覆蓋前者（interceptor 迴圈順序決定）
- 沒有「移除單一 auth」的指令，只能 `config reset` 清光重設

---

### #4 多個 apikey scheme 只取第一個

**位置：** [src/generator/config.ts:7](src/generator/config.ts#L7)

```ts
const apikeyScheme = schemes.find((s) => s.type === 'apikey')
```

**影響：** spec 若同時宣告 `X-API-Key`（header）和 `api_key`（query），只會採用第一個當預設。

**建議方向：** 與 #1 一起處理，允許 runtime 指定要用哪個 scheme。

---

### #5 Swagger 2.0 完全沒抽 security

**位置：** [src/parser/analyzer.ts:183](src/parser/analyzer.ts#L183)

```ts
return { title, version, baseUrl, security: [], tags: ..., endpoints }
```

**影響：**
- `config show` 不會顯示 auth 提示
- apikey 的 `--header` 預設值永遠是 `'X-API-Key'`，即使 spec 寫的是別的名字
- `inQuery` 永遠是 `false`

**建議方向：** 為 v2 實作對應的 `extractSecurityV2`，讀 `doc.securityDefinitions`。

---

### #6 oauth2 沒有對應的 setter

**位置：** [src/generator/config.ts:67](src/generator/config.ts#L67)

```ts
if (s.type === 'oauth2') return `OAuth2 Bearer token`
```

**影響：** spec 宣告 oauth2 時只會在 `config show` 的提示出現，但產生的 CLI 沒有 `auth oauth2` 指令。使用者只能自己去拿 token 後用 `auth bearer <token>`，體驗不佳。

**建議方向：**
- 短期：在 hint 明確寫「請先用其他工具取得 token，再 `config set auth bearer <token>`」
- 長期：實作 client credentials flow，讓 CLI 自己換 token

---

## 備註

- ~~#1、#3 是執行時彈性不足 → 直接影響 API 能不能打通~~ ✅ 已修復
- #2、#4 是實作細節 → 不影響功能但會留技術債
- #5、#6 是覆蓋範圍不足 → 影響特定 spec 類型的使用者體驗
