import * as Array from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Match from 'effect/Match'

import {
  CodebaseScanner,
  CodebaseScanResult,
} from '../../domain/codebase-scanner'
import { Config } from '../../domain/config'
import { IndexerCallbackError } from '../../domain/errors'

import { FileIndexer } from './file-indexer'

const voidFn = () => Effect.void

export class Indexer extends Effect.Service<Indexer>()(
  '@grepai/core/internal/services/indexer',
  {
    effect: Effect.gen(function* () {
      const codebaseScanner = yield* CodebaseScanner
      const fileIndexer = yield* FileIndexer
      const config = yield* Config

      const index = Effect.fnUntraced(function* (callbacks?: {
        onStarted?: () => Effect.Effect<void, IndexerCallbackError>
        onCodebaseScanned?: (
          result: CodebaseScanResult,
        ) => Effect.Effect<void, IndexerCallbackError>
        onFileCleaned?: (input: {
          filePath: string
          fileCount: number
        }) => Effect.Effect<void, IndexerCallbackError>
        onFileIndexed?: (input: {
          filePath: string
          fileCount: number
        }) => Effect.Effect<void, IndexerCallbackError>
        onFinished?: () => Effect.Effect<void, IndexerCallbackError>
      }) {
        const {
          onStarted = voidFn,
          onCodebaseScanned = voidFn,
          onFileCleaned = voidFn,
          onFileIndexed = voidFn,
          onFinished = voidFn,
        } = callbacks ?? {}

        yield* onStarted()

        const {
          new: newFiles,
          modified,
          unchanged: _, // Currently we don't do anything with unchanged files
          deleted,
        } = yield* codebaseScanner.scan().pipe(
          Effect.tap(onCodebaseScanned), //
        )

        const filesToClean = Array.appendAll(modified, deleted)
        const filesToIndex = Array.appendAll(newFiles, modified)

        yield* Effect.forEach(
          filesToClean,
          ({ filePath }) =>
            fileIndexer.clean(filePath).pipe(
              Effect.tap(() =>
                onFileCleaned({
                  filePath,
                  fileCount: filesToClean.length,
                }),
              ),
            ),
          {
            concurrency: Match.value(config.storage.type).pipe(
              Match.when('turso', () => 1),
              Match.when('postgres', () => 100),
              Match.exhaustive,
            ),
          },
        )
        yield* Effect.forEach(
          filesToIndex,
          (file) =>
            fileIndexer.index(file).pipe(
              Effect.tap(() =>
                onFileIndexed({
                  filePath: file.filePath,
                  fileCount: filesToIndex.length,
                }),
              ),
            ),
          {
            concurrency: Match.value(config.storage.type).pipe(
              Match.when('turso', () => 1),
              Match.when('postgres', () => 100),
              Match.exhaustive,
            ),
          },
        )

        yield* onFinished()
      })

      return {
        index,
      } as const
    }),
  },
) {}
