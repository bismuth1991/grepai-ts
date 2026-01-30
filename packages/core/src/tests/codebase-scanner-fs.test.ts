import { BunContext } from '@effect/platform-bun'
import { describe, it, expect } from '@effect/vitest'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

import { CodebaseScanner } from '../domain/codebase-scanner'
import { CodebaseScannerFs } from '../internal/services/codebase-scanner-fs'
import { ConfigJson } from '../internal/services/config-json'

const TestLive = CodebaseScannerFs.pipe(
  Layer.provide(ConfigJson),
  Layer.provideMerge(BunContext.layer),
)

describe('CodebaseScannerFs', () => {
  it.effect('returns an array of file paths matching include patterns', () =>
    Effect.gen(function* () {
      const scanner = yield* CodebaseScanner
      const result = yield* scanner.scan()

      expect(result).toMatchSnapshot()
    }).pipe(Effect.provide(TestLive)),
  )

  describe('exclude patterns', () => {
    it.effect('excludes node_modules directory', () =>
      Effect.gen(function* () {
        const scanner = yield* CodebaseScanner
        const result = yield* scanner.scan()

        const hasNodeModules = result.some((file) =>
          file.includes('node_modules'),
        )
        expect(hasNodeModules).toBe(false)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('excludes .opencode directory', () =>
      Effect.gen(function* () {
        const scanner = yield* CodebaseScanner
        const result = yield* scanner.scan()

        const hasOpencode = result.some((file) => file.includes('.opencode'))
        expect(hasOpencode).toBe(false)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('excludes .turbo directory', () =>
      Effect.gen(function* () {
        const scanner = yield* CodebaseScanner
        const result = yield* scanner.scan()

        const hasTurbo = result.some((file) => file.includes('.turbo'))
        expect(hasTurbo).toBe(false)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('excludes .cache directory', () =>
      Effect.gen(function* () {
        const scanner = yield* CodebaseScanner
        const result = yield* scanner.scan()

        const hasCache = result.some((file) => file.includes('.cache'))
        expect(hasCache).toBe(false)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('excludes .zed directory', () =>
      Effect.gen(function* () {
        const scanner = yield* CodebaseScanner
        const result = yield* scanner.scan()

        const hasZed = result.some((file) => file.includes('.zed'))
        expect(hasZed).toBe(false)
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('include patterns', () => {
    it.effect('only includes TypeScript files', () =>
      Effect.gen(function* () {
        const scanner = yield* CodebaseScanner
        const result = yield* scanner.scan()

        const allTypescript = result.every((file) => file.endsWith('.ts'))
        expect(allTypescript).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('includes files from packages/core/src', () =>
      Effect.gen(function* () {
        const scanner = yield* CodebaseScanner
        const result = yield* scanner.scan()

        const hasCoreFiles = result.some((file) =>
          file.includes('packages/core/src'),
        )
        expect(hasCoreFiles).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('includes this test file itself', () =>
      Effect.gen(function* () {
        const scanner = yield* CodebaseScanner
        const result = yield* scanner.scan()

        const hasThisTestFile = result.some((file) =>
          file.includes('codebase-scanner-fs.test.ts'),
        )
        expect(hasThisTestFile).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('includes domain files', () =>
      Effect.gen(function* () {
        const scanner = yield* CodebaseScanner
        const result = yield* scanner.scan()

        const hasDomainFiles = result.some((file) =>
          file.includes('domain/codebase-scanner.ts'),
        )
        expect(hasDomainFiles).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )
  })

  it.effect('returns a non-empty array of files', () =>
    Effect.gen(function* () {
      const scanner = yield* CodebaseScanner
      const result = yield* scanner.scan()

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
    }).pipe(Effect.provide(TestLive)),
  )
})
