import { globSync } from 'node:fs'

import { FileSystem, Path } from '@effect/platform'
import { connect } from '@tursodatabase/sync'
import { AgentFS } from 'agentfs-sdk'
import * as Array from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Hash from 'effect/Hash'
import * as Layer from 'effect/Layer'
import * as Match from 'effect/Match'
import * as Record from 'effect/Record'

import { SupportedLanguage } from '../../domain'
import { CodebaseScanner } from '../../domain/codebase-scanner'
import { Config } from '../../domain/config'
import { DocumentStorage } from '../../domain/document-storage'
import { CodebaseScannerError } from '../../domain/errors'

export const CodebaseScannerAgentFs = Layer.scoped(
  CodebaseScanner,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const config = yield* Config
    const documentStorage = yield* DocumentStorage

    if (!config.experimental__agentFs) {
      return yield* new CodebaseScannerError({
        cause: '`experimental__agentFs` is not enabled.',
      })
    }
    const { authToken, url, syncMode } = config.experimental__agentFs
    const baseAgentFsLocalPath = path.resolve(config.cwd, './.grepai/agentfs')

    yield* fs.makeDirectory(baseAgentFsLocalPath, { recursive: true })

    const db = yield* Effect.tryPromise({
      try: async () => {
        const db = await connect({
          path: path.join(baseAgentFsLocalPath, 'local.db'),
          url,
          authToken,
          clientName: 'grepai',
        })
        if (syncMode === 'pull') {
          await db.pull()
        }
        return db
      },
      catch: (cause) => new CodebaseScannerError({ cause }),
    })

    const agentFs = yield* Effect.tryPromise({
      try: () => AgentFS.openWith(db),
      catch: (cause) => new CodebaseScannerError({ cause }),
    })

    yield* Effect.addFinalizer(() => Effect.promise(() => agentFs.close()))

    const useAgentFs = <T>(f: (af: typeof agentFs) => Promise<T>) =>
      Effect.tryPromise({
        try: () => f(agentFs),
        catch: (cause) => new CodebaseScannerError({ cause }),
      })

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
          Effect.map(Array.filterMap(withLanguageOption)),
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

        const entries = yield* useAgentFs((a) => a.fs.readdir(path))
        yield* Effect.forEach(entries, (entry) =>
          Effect.gen(function* () {
            const normalizedPath = path === '/' ? '' : path.replace(/\/$/, '')
            const normalizedEntry = entry.replace(/^\//, '')
            const fullPath = normalizedPath + normalizedEntry

            const stats = yield* useAgentFs((a) => a.fs.stat(fullPath))
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

    const scanAgentFs = Effect.fnUntraced(function* () {
      if (syncMode === 'push') {
        const results = yield* scanFs()
        const { new: newFiles, modified, deleted } = results

        yield* Effect.forEach(
          [...newFiles, ...modified],
          ({ filePath, content }) =>
            useAgentFs((a) => a.fs.writeFile(filePath, content)),
        )
        yield* Effect.forEach(deleted, ({ filePath }) =>
          useAgentFs((a) => a.fs.deleteFile(filePath)),
        )
        yield* Effect.tryPromise({
          try: () => db.push(),
          catch: (cause) => new CodebaseScannerError({ cause }),
        })

        return results
      }

      const files = yield* readDirRecursiveAgentFs().pipe(
        Effect.map(Array.filterMap(withLanguageOption)),
        Effect.flatMap(
          Effect.forEach(({ filePath, language }) =>
            useAgentFs((a) =>
              a.fs.readFile(filePath, { encoding: 'utf-8' }),
            ).pipe(
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

      return yield* toScanResults(files)
    })

    return CodebaseScanner.of({
      scan: scanAgentFs,
    })
  }),
)
