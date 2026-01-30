import { FileSystem, Path } from '@effect/platform'
import * as Effect from 'effect/Effect'
import * as JSONSchema from 'effect/JSONSchema'

import { GrepAiConfig } from '../../domain/config'

export const buildConfigJsonSchema = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  yield* fs.writeFileString(
    path.resolve(import.meta.dirname, '../../grepai-config-schema.json'),
    // @effect-diagnostics-next-line preferSchemaOverJson:off
    JSON.stringify(JSONSchema.make(GrepAiConfig), null, 2),
  )
})
