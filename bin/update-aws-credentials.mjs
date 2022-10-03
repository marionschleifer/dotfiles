import { readFile, writeFile, cp } from 'fs/promises'
import { homedir } from 'os'
import { Interface } from 'readline'
import { createInterface } from 'readline/promises'

try {
  await main()
} catch (error) {
  console.error(error.message)
}

async function main() {
  const credentialsPath = `${homedir()}/.aws/credentials`
  const fileContents = await readFile(credentialsPath, 'utf8')

  const originalFileLines = fileContents.split('\n')
  const profiles = originalFileLines
    .map((line, index) =>
      line.startsWith('[') && line.endsWith(']') && validCredentialsBlock(index, originalFileLines)
        ? { name: line.slice(1, -1), credentialsStart: index + 1 }
        : { name: '', credentialsStart: -1 }
    )
    .filter((x) => x.name)

  console.log(
    `Paste the following text here: [arn:aws:sts::...]\naws_access_key_id=...\naws_secret_access_key=...\naws_session_token=...\n\nDon't worry if you copy a bit too much from the top or bottom\n`
  )

  const stdinLines = await readFourLines()

  console.log()

  const mapping = findMapping(stdinLines)
  const newProfileContents = parseProfileContents(mapping, stdinLines)
  const profile = profiles.find(({ name }) => name === mapping.project)

  if (!profile) throw new Error(`Profile ${mapping.project} not found`)

  const newFileLines = [...originalFileLines]
  newProfileContents.forEach((line, index) => (newFileLines[profile.credentialsStart + index] = line))

  await cp(credentialsPath, `${credentialsPath}.bak`)
  await writeFile(credentialsPath, newFileLines.join('\n'))
  console.log(`Updated ${credentialsPath}, backed up to ${credentialsPath}.bak`)
}

/**
 * @param {number} profileIndex
 * @param {string[]} fileLines
 */
function validCredentialsBlock(profileIndex, fileLines) {
  return requiredStarts().every((requiredStart, index) =>
    fileLines[profileIndex + 1 + index]?.startsWith(requiredStart)
  )
}

/**
 * @param {{ needle: string; project: string; }} mapping
 * @param {string[]} stdinLines
 */
function parseProfileContents(mapping, stdinLines) {
  const index = findProfileIndex(stdinLines, mapping)
  const values = stdinLines.slice(index + 1, index + 4)

  if (!requiredStarts().every((requiredStart, index) => values[index]?.startsWith(requiredStart))) {
    const expected = JSON.stringify(requiredStarts())
    const actual = JSON.stringify(values)
    throw new Error(`Unexpected format, credentials must start with ${expected}, but was ${actual}`)
  }

  return values
}

function requiredStarts() {
  return ['aws_access_key_id=', 'aws_secret_access_key=', 'aws_session_token=']
}

function findProfileIndex(stdinLines, mapping) {
  return stdinLines.findIndex((line) => line.includes(mapping.needle))
}

/**
 * @param {string[]} stdinLines
 */
function findMapping(stdinLines) {
  const mapping = mappings().find(({ needle }) => stdinLines.some((line) => line.includes(needle)))
  if (!mapping) {
    console.log('No mapping found in mappings', mappings())
    process.exit(1)
  }
  return mapping
}

function mappings() {
  return [
    { needle: 'sts::1742', project: 'default' },
    { needle: 'sts::6050', project: 'portal' },
  ]
}

/**
 * @returns {Promise<string[]>}
 */
function readFourLines() {
  const readline = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    const lines = []
    readline.on('line', (line) => {
      lines.push(line)
      if (lines.length === 4) waitForRemainingInputAndResolve(resolve, readline, lines)
    })
  })
}

/**
 * @param {{ (value: string[]): void; }} resolve
 * @param {Interface} readline
 * @param {string[]} lines
 */
function waitForRemainingInputAndResolve(resolve, readline, lines) {
  setTimeout(() => {
    readline.close()
    resolve(lines)
  }, 100)
}
