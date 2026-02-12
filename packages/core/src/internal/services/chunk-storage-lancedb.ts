import * as Array from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Schema from 'effect/Schema'

import { ChunkStorageError, SchemaValidationFailed } from '../../domain'
import {
  ChunkEmbeddingInsertInput,
  ChunkSearchResult,
} from '../../domain/chunk'
import { ChunkStorage } from '../../domain/chunk-storage'
import { Embedder } from '../../domain/embedder'
import { EmbeddingA } from '../../domain/embedding'

import { LanceDb } from './lancedb'

export const ChunkStorageLanceDb = Layer.effect(
  ChunkStorage,
  Effect.gen(function* () {
    const db = yield* LanceDb
    const embedder = yield* Embedder

    const search = Effect.fnUntraced(
      function* (input: { query: string; topK?: number }) {
        const { query, topK = 10 } = input

        const queryEmbedding = yield* embedder
          .embedQuery(query)
          .pipe(Effect.flatMap(Schema.decode(EmbeddingA)))

        return yield* db
          .useTable((t) =>
            t
              .vectorSearch(Array.fromIterable(queryEmbedding))
              .distanceType('cosine')
              .limit(topK)
              .select(['filePath', 'startLine', 'endLine', '_distance'])
              .toArray(),
          )
          .pipe(
            Effect.flatMap(
              Schema.decodeUnknown(Schema.Array(ChunkSearchResult)),
            ),
          )
      },
      Effect.catchTags({
        ParseError: (cause) => new SchemaValidationFailed({ cause }),
        LanceDbError: (cause) => new ChunkStorageError({ cause }),
      }),
    )

    const getAllWithoutEmbedding = Effect.fnUntraced(function* () {
      return yield* Effect.succeed([])
    })

    const insertMany = db.insertManyChunks

    const insertManyEmbeddings = Effect.fnUntraced(
      function* (embeddings: ReadonlyArray<ChunkEmbeddingInsertInput>) {
        const decoded = yield* Schema.decode(
          Schema.Array(
            Schema.Struct({
              chunkId: Schema.String,
              embedding: EmbeddingA,
            }),
          ),
        )(embeddings)

        yield* db.insertChunksEmbeddings(decoded)
      },
      Effect.catchTags({
        LanceDbError: (cause) => new ChunkStorageError({ cause }),
        ParseError: (cause) => new SchemaValidationFailed({ cause }),
      }),
    )

    const removeByFilePath = () => Effect.void

    return ChunkStorage.of({
      search,
      getAllWithoutEmbedding,
      insertMany,
      insertManyEmbeddings,
      removeByFilePath,
    })
  }),
)
