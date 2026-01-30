import { globSync } from 'node:fs'

import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

import { CodebaseScanner } from '../../domain/codebase-scanner'
import { Config } from '../../domain/config'
import { CodebaseScannerError } from '../../domain/errors'

export const CodebaseScannerFs = Layer.effect(
  CodebaseScanner,
  Effect.gen(function* () {
    const config = yield* Config

    const scan = Effect.fnUntraced(function* () {
      const files = yield* Effect.try({
        try: () =>
          globSync(config.include, {
            cwd: config.cwd,
            exclude: config.exclude.map((pattern) => {
              const hasPathSep = pattern.includes('/') || pattern.includes('\\')
              if (!hasPathSep) {
                return `**/${pattern}`
              }
              return pattern
            }),
          }),
        catch: (cause) => new CodebaseScannerError({ cause }),
      })

      return files
    })

    return CodebaseScanner.of({
      scan,
    })
  }),
)
