export function genUtilsOutput(): string {
  return `import chalk from 'chalk'

export function printResponse(data, format = 'table') {
  if (format === 'json') {
    console.log(JSON.stringify(data, null, 2))
    return
  }

  if (format === 'raw') {
    console.log(data)
    return
  }

  // table format
  if (Array.isArray(data)) {
    if (data.length === 0) {
      console.log(chalk.gray('(empty)'))
      return
    }
    if (typeof data[0] === 'object' && data[0] !== null) {
      const keys = Object.keys(data[0])
      const header = keys.map((k) => chalk.cyan(k)).join('  |  ')
      console.log(header)
      console.log('-'.repeat(header.length))
      for (const row of data) {
        console.log(keys.map((k) => String(row[k] ?? '')).join('  |  '))
      }
      return
    }
    data.forEach((item) => console.log(item))
    return
  }

  if (typeof data === 'object' && data !== null) {
    for (const [k, v] of Object.entries(data)) {
      console.log(chalk.cyan(String(k).padEnd(20)), String(v ?? ''))
    }
    return
  }

  console.log(data)
}

export function printError(message, status) {
  if (status) {
    console.error(chalk.red('Error ' + status + ': ' + message))
  } else {
    console.error(chalk.red('Error: ' + message))
  }
}
`
}
