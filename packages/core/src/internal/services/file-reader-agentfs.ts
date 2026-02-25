import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

import { Config } from '../../domain/config'
import { FileReaderError } from '../../domain/errors'
import { FileReader } from '../../domain/file-reader'

import { AgentFs } from './agentfs'

export const FileReaderAgentFs = Layer.effect(
  FileReader,
  Effect.gen(function* () {
    const agentFs = yield* AgentFs
    const config = yield* Config

    if (!config.experimental__agentFs) {
      return yield* new FileReaderError({
        cause: new Error('experimental__agentFs is not enabled'),
      })
    }

    return FileReader.of({
      read: Effect.fnUntraced(function* ({
        filePath,
        limit = 2000,
        offset = 1,
      }) {
        const content = yield* agentFs
          .use((a) => a.fs.readFile(filePath, { encoding: 'utf-8' }))
          .pipe(Effect.mapError((cause) => new FileReaderError({ cause })))

        const lines =
          content.length === 0
            ? []
            : content.split('\n').map((line) => line.replace(/\r$/, ''))

        const startIndex = Math.max(0, offset - 1)
        const selectedLines = lines.slice(startIndex, startIndex + limit)

        return selectedLines
          .map((line, index) => `${startIndex + index + 1}: ${line}`)
          .join('\n')
      }),
    })
  }),
)
