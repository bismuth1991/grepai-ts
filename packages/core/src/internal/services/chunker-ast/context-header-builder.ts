import * as Effect from 'effect/Effect'
import * as Record from 'effect/Record'
import * as String from 'effect/String'

export class ContextHeaderBuilder extends Effect.Service<ContextHeaderBuilder>()(
  '@grepai/core/internal/services/chunker-ast/context-header-builder/ContextHeaderBuilder',
  {
    sync: () => {
      const stringify = (input: {
        filePath: string
        scope: ReadonlyArray<ReadonlyArray<string>>
      }) => {
        const yml = Bun.YAML.stringify(
          Record.filter(
            {
              filePath: input.filePath,
              scope: input.scope.map((scope) => scope.join(' -> ')),
            },
            (val) => !!val.length,
          ),
          null,
          2,
        )

        return (
          yml
            .split('\n')
            .map((line) => String.padStart(line.length + 2, '# ')(line))
            .join('\n') + '\n---\n'
        )
      }

      return { stringify } as const
    },
  },
) {}
