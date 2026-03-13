export function genLibConfig(cliName: string): string {
  return `import fs from 'fs'
import os from 'os'
import path from 'path'

const CONFIG_DIR = path.join(os.homedir(), '.config', '${cliName}')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
  } catch {
    return {}
  }
}

function writeConfig(config) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
}

export function getConfig() {
  return readConfig()
}

export function setBaseUrl(url) {
  const config = readConfig()
  config.baseUrl = url
  writeConfig(config)
}

export function setAuth(auth) {
  const config = readConfig()
  config.auth = auth
  writeConfig(config)
}

export function resetConfig() {
  writeConfig({})
}
`
}
