import { FileSystem } from '@effect/platform'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

import { FileReaderError } from '../../domain/errors'
import { FileReader } from '../../domain/file-reader'

export const FileReaderFs = Layer.effect(
  FileReader,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    return FileReader.of({
      read: Effect.fnUntraced(
        function* ({ filePath, limit = 2000, offset = 1 }) {
          const content = yield* fs.readFileString(filePath)

          const lines =
            content.length === 0
              ? []
              : content.split('\n').map((line) => line.replace(/\r$/, ''))

          const startIndex = Math.max(0, offset - 1)
          const selectedLines = lines.slice(startIndex, startIndex + limit)

          return selectedLines
            .map((line, index) => `${startIndex + index + 1}: ${line}`)
            .join('\n')
        },
        Effect.catchTags({
          BadArgument: (cause) => new FileReaderError({ cause }),
          SystemError: (cause) => new FileReaderError({ cause }),
        }),
      ),
    })
  }),
)
