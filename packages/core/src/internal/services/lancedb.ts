import { Path } from '@effect/platform'
import * as lance from '@lancedb/lancedb'
import {
  Field,
  FixedSizeList,
  Float32,
  Int32,
  Schema,
  Utf8,
} from 'apache-arrow'
import * as Array from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import * as Record from 'effect/Record'

import { LanceDbError } from '../../domain'
import { ChunkInsertInput } from '../../domain/chunk'
import { Config } from '../../domain/config'
import { DocumentInsertInput } from '../../domain/document'

const CHUNK_TABLE = 'chunks'
const FLUSH_INSERT_QUEUE_THRESHOLD = 100

export class LanceDb extends Effect.Service<LanceDb>()(
  '@grepai/core/internal/services/lancedb',
  {
    scoped: Effect.gen(function* () {
      const path = yield* Path.Path
      const config = yield* Config

      let documentInsertQueue: Record<
        string,
        { filePath: string; fileHash: string }
      > = {}
      let chunkInsertQueue: Record<string, ChunkInsertInput> = {}
      let insertQueue: Array<
        ChunkInsertInput & { filePath: string; fileHash: string } & {
          embedding: ReadonlyArray<number>
          createdAt: string
          updatedAt: string
        }
      > = []

      const db = yield* Effect.promise(() =>
        lance.connect(path.resolve(config.cwd, './.grepai')),
      )

      const use =
        <T>(thing: T) =>
        <K>(f: (db: T) => Promise<K>) =>
          Effect.tryPromise({
            try: () => f(thing),
            catch: (cause) => new LanceDbError({ cause }),
          })

      const useDb = use(db)

      const useTable = (tableName: string) =>
        Effect.fnUntraced(function* <T>(f: (table: lance.Table) => Promise<T>) {
          const table = yield* useDb((db) => db.openTable(tableName))
          return yield* use(table)(f)
        })

      const insertDocument = (document: DocumentInsertInput) => {
        documentInsertQueue[document.filePath] = {
          filePath: document.filePath,
          fileHash: document.hash,
        }
        return Effect.void
      }
      const insertManyChunks = (chunks: ReadonlyArray<ChunkInsertInput>) => {
        for (const chunk of chunks) {
          chunkInsertQueue[chunk.id] = chunk
        }
        return Effect.void
      }
      const insertChunksEmbeddings = Effect.fnUntraced(function* (
        input: ReadonlyArray<{
          chunkId: string
          embedding: ReadonlyArray<number>
        }>,
      ) {
        yield* Effect.forEach(input, ({ chunkId, embedding }) =>
          Effect.gen(function* () {
            const now = new Date().toISOString()
            const chunk = yield* Option.fromNullable(chunkInsertQueue[chunkId])
            const document = yield* Option.fromNullable(
              documentInsertQueue[chunk.filePath],
            )

            return yield* Effect.succeed({
              ...document,
              ...chunk,
              embedding,
              createdAt: now,
              updatedAt: now,
            })
          }),
        ).pipe(
          Effect.tap((chunks) => insertQueue.push(...chunks)),
          Effect.catchTags({
            NoSuchElementException: () =>
              new LanceDbError({
                cause:
                  'Failed to insert chunk embeddings. Could not find chunk or document.',
              }),
          }),
        )

        if (
          Record.keys(documentInsertQueue).length >=
          FLUSH_INSERT_QUEUE_THRESHOLD
        ) {
          yield* flushInsertQueue()
        }
      })

      const flushInsertQueue = Effect.fnUntraced(function* () {
        if (Array.isNonEmptyArray(insertQueue)) {
          yield* useTable(CHUNK_TABLE)((t) => t.add(insertQueue))
          documentInsertQueue = {}
          chunkInsertQueue = {}
          insertQueue = []
        }
      })

      yield* Effect.addFinalizer(() =>
        flushInsertQueue().pipe(
          Effect.zipRight(Effect.sync(() => db.close())),
          Effect.orDie,
        ),
      )

      return {
        use: useDb,
        useTable: useTable(CHUNK_TABLE),
        insertDocument,
        insertManyChunks,
        insertChunksEmbeddings,
      } as const
    }),
  },
) {}

class Migrations extends Effect.Service<Migrations>()(
  '@grepai/core/internal/services/lancedb/Migrations',
  {
    effect: Effect.gen(function* () {
      const config = yield* Config
      const lance = yield* LanceDb

      yield* lance.use((db) =>
        db.createEmptyTable(
          CHUNK_TABLE,
          new Schema([
            new Field('id', new Utf8(), false),
            new Field('filePath', new Utf8(), false),
            new Field('fileHash', new Utf8(), false),
            new Field('startLine', new Int32(), false),
            new Field('endLine', new Int32(), false),
            new Field('content', new Utf8(), false),
            new Field(
              'embedding',
              new FixedSizeList(
                config.embedding.dimensions,
                new Field('item', new Float32(), true),
              ),
              false,
            ),
            new Field('createdAt', new Utf8(), false),
            new Field('updatedAt', new Utf8(), false),
          ]),
          {
            mode: 'create',
            existOk: true,
          },
        ),
      )

      return {}
    }),
  },
) {}

export const LanceDbLive = Migrations.Default.pipe(
  Layer.provideMerge(LanceDb.Default),
)
