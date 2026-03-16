import { Path } from '@effect/platform'
import * as Effect from 'effect/Effect'

import { Config } from '../../domain'

export class FilePathNormalizer extends Effect.Service<FilePathNormalizer>()(
  '@grepai/core/internal/services/file-path-normalizer/FilePathNormalizer',
  {
    effect: Effect.gen(function* () {
      const config = yield* Config
      const path = yield* Path.Path

      function normalize<
        T extends {
          filePath: string
          [x: string]: unknown
        },
      >(input: T) {
        const isAbsolutePath = input.filePath.startsWith('/')
        if (config.experimental__agentFs) {
          return {
            ...input,
            filePath: isAbsolutePath ? input.filePath : `/${input.filePath}`,
          }
        }
        return {
          ...input,
          filePath: isAbsolutePath
            ? input.filePath
            : path.join(config.cwd, input.filePath),
        }
      }

      return {
        normalize,
      } as const
    }),
  },
) {}
