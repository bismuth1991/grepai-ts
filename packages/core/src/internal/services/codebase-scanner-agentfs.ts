import { FileSystem } from '@effect/platform'
import * as Array from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Hash from 'effect/Hash'
import * as Layer from 'effect/Layer'
import * as Match from 'effect/Match'
import * as Record from 'effect/Record'
import { globSync } from 'fast-glob'

import { SupportedLanguage } from '../../domain'
import { CodebaseScanner } from '../../domain/codebase-scanner'
import { Config } from '../../domain/config'
import { DocumentStorage } from '../../domain/document-storage'
import { CodebaseScannerError } from '../../domain/errors'

import { AgentFs } from './agentfs'

export const CodebaseScannerAgentFs = Layer.scoped(
  CodebaseScanner,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const config = yield* Config
    const documentStorage = yield* DocumentStorage
    const agentFs = yield* AgentFs

    if (!config.experimental__agentFs) {
      return yield* new CodebaseScannerError({
        cause: '`experimental__agentFs` is not enabled.',
      })
    }
    const { syncMode } = config.experimental__agentFs

    function withLanguageOption(filePath: string) {
      return Match.value(filePath.split('.').at(-1) ?? '').pipe(
        Match.when('ts', () => ({
          filePath,
          language: 'typescript' as const,
        })),
        Match.when('tsx', () => ({
          filePath,
          language: 'tsx' as const,
        })),
        Match.when('json', () => ({
          filePath,
          language: 'json' as const,
        })),
        Match.when('js', () => ({
          filePath,
          language: 'javascript' as const,
        })),
        Match.when('mjs', () => ({
          filePath,
          language: 'javascript' as const,
        })),
        Match.when('cjs', () => ({
          filePath,
          language: 'javascript' as const,
        })),
        Match.option,
      )
    }

    const toScanResults = Effect.fnUntraced(function* (
      files: ReadonlyArray<{
        filePath: string
        language: SupportedLanguage
        hash: string
        content: string
      }>,
    ) {
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
    })

    const scanFs = Effect.fnUntraced(
      function* () {
        const files = yield* Effect.try({
          try: () =>
            globSync(Array.fromIterable(config.include), {
              cwd: config.cwd,
              ignore: Array.fromIterable(
                config.exclude.map((pattern) => {
                  const hasPathSep =
                    pattern.includes('/') || pattern.includes('\\')
                  if (!hasPathSep) {
                    return `**/${pattern}`
                  }
                  return pattern
                }),
              ),
            }),
          catch: (cause) => new CodebaseScannerError({ cause }),
        }).pipe(
          Effect.map(Array.filterMap(withLanguageOption)),
          Effect.flatMap(
            Effect.forEach(
              ({ filePath, language }) =>
                fs.readFileString(filePath).pipe(
                  Effect.map((content) => ({
                    filePath,
                    language,
                    hash: Hash.string(content).toString(),
                    content,
                  })),
                ),
              { concurrency: 'unbounded' },
            ),
          ),
        )

        return yield* toScanResults(files)
      },
      Effect.catchTags({
        BadArgument: (cause) => new CodebaseScannerError({ cause }),
        SystemError: (cause) => new CodebaseScannerError({ cause }),
      }),
    )

    const readDirRecursiveAgentFs: (
      path?: string,
    ) => Effect.Effect<ReadonlyArray<string>, CodebaseScannerError, never> =
      Effect.fnUntraced(function* (path = '/') {
        const results: Array<string> = []

        const entries = yield* agentFs
          .use((a) => a.fs.readdir(path))
          .pipe(Effect.mapError((cause) => new CodebaseScannerError({ cause })))
        yield* Effect.forEach(entries, (entry) =>
          Effect.gen(function* () {
            const normalizedPath = path === '/' ? '' : path.replace(/\/$/, '')
            const normalizedEntry = entry.replace(/^\//, '')
            const fullPath = normalizedPath + '/' + normalizedEntry

            const stats = yield* agentFs
              .use((a) => a.fs.stat(fullPath))
              .pipe(
                Effect.mapError((cause) => new CodebaseScannerError({ cause })),
              )
            if (stats.isDirectory()) {
              const subFiles = yield* readDirRecursiveAgentFs(fullPath)
              results.push(...subFiles)
            } else {
              results.push(fullPath)
            }
          }),
        )

        return results
      })

    const scanAgentFs = Effect.fnUntraced(
      function* () {
        if (syncMode === 'push') {
          const results = yield* scanFs()
          const { new: newFiles, modified, deleted } = results

          yield* Effect.forEach(
            [...newFiles, ...modified],
            ({ filePath, content }) =>
              agentFs.use((a) => a.fs.writeFile(filePath, content)),
            { concurrency: 'unbounded' },
          )
          yield* Effect.forEach(
            deleted,
            ({ filePath }) => agentFs.use((a) => a.fs.deleteFile(filePath)),
            { concurrency: 'unbounded' },
          )
          yield* agentFs.dbPush()

          return results
        }

        const files = yield* readDirRecursiveAgentFs().pipe(
          Effect.map(Array.filterMap(withLanguageOption)),
          Effect.flatMap(
            Effect.forEach(
              ({ filePath, language }) =>
                agentFs
                  .use((a) => a.fs.readFile(filePath, { encoding: 'utf-8' }))
                  .pipe(
                    Effect.map((content) => ({
                      filePath,
                      language,
                      hash: Hash.string(content).toString(),
                      content,
                    })),
                  ),
              { concurrency: 'unbounded' },
            ),
          ),
        )

        return yield* toScanResults(files)
      },
      Effect.catchTags({
        AgentFsError: (cause) => new CodebaseScannerError({ cause }),
      }),
    )

    return CodebaseScanner.of({
      scan: scanAgentFs,
    })
  }),
)
