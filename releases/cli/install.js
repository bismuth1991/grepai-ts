const { existsSync, symlinkSync, mkdirSync, chmodSync } = require('fs')
const { execSync } = require('child_process')
const path = require('path')

function detectLibc() {
  if (process.platform !== 'linux') {
    return null
  }

  if (process.report?.getReport()?.header?.glibcVersionRuntime) {
    return 'glibc'
  }

  try {
    const ldd = execSync('ldd --version 2>&1', { encoding: 'utf8' })
    if (/musl/i.test(ldd)) {
      return 'musl'
    }
    if (/GLIBC|GNU libc/i.test(ldd)) {
      return 'glibc'
    }
  } catch {}

  if (existsSync('/etc/alpine-release')) {
    return 'musl'
  }

  try {
    const ldso = execSync('ls /lib/ld-musl-* 2>/dev/null', {
      encoding: 'utf8',
    })
    if (ldso.trim()) {
      return 'musl'
    }
  } catch {}

  return 'glibc'
}

function getPlatformKey() {
  const os = process.platform
  const arch = process.arch
  const libc = detectLibc()

  return libc ? `${os}-${arch}-${libc}` : `${os}-${arch}`
}

const PLATFORMS = {
  'darwin-arm64': '@grepai/cli-darwin-arm64',
  'linux-arm64-musl': '@grepai/cli-linux-arm64-musl',
  'linux-x64-glibc': '@grepai/cli-linux-x64',
  'linux-x64-musl': '@grepai/cli-linux-x64-musl',
}

const key = getPlatformKey()
const pkg = PLATFORMS[key]

if (!pkg) {
  console.error(`@grepai/cli: unsupported platform ${key}`)
  console.error(
    `@grepai/cli: supported platforms: ${Object.keys(PLATFORMS).join(', ')}`,
  )
  process.exit(1)
}

const binDir = path.join(__dirname, 'bin')
const target = path.join(binDir, 'grepai')

let source
try {
  source = require.resolve(pkg)
} catch (error) {
  const message = error && error.message ? error.message : String(error)
  console.error(
    `@grepai/cli: failed to resolve platform package ${pkg}: ${message}`,
  )
  process.exit(1)
}

if (!existsSync(target)) {
  mkdirSync(binDir, { recursive: true })

  try {
    symlinkSync(source, target)
    chmodSync(target, 0o755)
  } catch (error) {
    const message = error && error.message ? error.message : String(error)
    console.error(
      `@grepai/cli: failed to prepare executable at ${target}: ${message}`,
    )
    process.exit(1)
  }
}
