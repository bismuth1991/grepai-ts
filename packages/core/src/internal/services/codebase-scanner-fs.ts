import { globSync } from 'node:fs'

import { FileSystem } from '@effect/platform'
import * as Array from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Hash from 'effect/Hash'
import * as Layer from 'effect/Layer'
import * as Match from 'effect/Match'
import * as Record from 'effect/Record'

import { CodebaseScanner } from '../../domain/codebase-scanner'
import { Config } from '../../domain/config'
import { DocumentStorage } from '../../domain/document-storage'
import { CodebaseScannerError } from '../../domain/errors'

export const CodebaseScannerFs = Layer.effect(
  CodebaseScanner,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const config = yield* Config
    const documentStorage = yield* DocumentStorage

    const scan = Effect.fnUntraced(
      function* () {
        const files = yield* Effect.try({
          try: () =>
            globSync(config.include, {
              cwd: config.cwd,
              exclude: config.exclude.map((pattern) => {
                const hasPathSep =
                  pattern.includes('/') || pattern.includes('\\')
                if (!hasPathSep) {
                  return `**/${pattern}`
                }
                return pattern
              }),
            }),
          catch: (cause) => new CodebaseScannerError({ cause }),
        }).pipe(
          Effect.map(
            Array.filterMap((filePath) =>
              Match.value(filePath.split('.').at(-1) ?? '').pipe(
                Match.when('ts', () => ({
                  filePath,
                  language: 'typescript' as const,
                })),
                Match.when('tsx', () => ({
                  filePath,
                  language: 'tsx' as const,
                })),
                Match.option,
              ),
            ),
          ),
          Effect.flatMap(
            Effect.forEach(({ filePath, language }) =>
              fs.readFileString(filePath).pipe(
                Effect.map((content) => ({
                  filePath,
                  language,
                  hash: Hash.string(content).toString(),
                  content,
                })),
              ),
            ),
          ),
        )

        const fileMap = Record.fromIterableBy(files, ({ filePath }) => filePath)

        const documents = yield* documentStorage.getAll()
        const documentMap = Record.fromIterableBy(
          documents,
          ({ filePath }) => filePath,
        )

        const newFiles = Array.filter(
          files,
          ({ filePath }) => !documentMap[filePath],
        )
        const modified = Array.filter(
          files,
          ({ filePath, hash }) =>
            !!documentMap[filePath] && documentMap[filePath].hash !== hash,
        )
        const unchanged = Array.filter(
          files,
          ({ filePath, hash }) =>
            !!documentMap[filePath] && documentMap[filePath].hash === hash,
        )
        const deleted = Array.filter(
          documents,
          ({ filePath }) => !fileMap[filePath],
        )

        return {
          new: newFiles,
          unchanged,
          modified,
          deleted,
        }
      },
      Effect.catchTags({
        BadArgument: (cause) => new CodebaseScannerError({ cause }),
        SystemError: (cause) => new CodebaseScannerError({ cause }),
      }),
    )

    return CodebaseScanner.of({
      scan,
    })
  }),
)
