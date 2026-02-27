import * as Effect from 'effect/Effect'

export class CommandUtils extends Effect.Service<CommandUtils>()(
  '@grepai/cli-dev/internal/services/command-utils/CommandUtils',
  {
    sync: () => {
      function mergeRanges(ranges: Ranges): string {
        return [...ranges]
          .sort((a, b) => a.startLine - b.startLine)
          .reduce<[number, number][]>((acc, { startLine, endLine }) => {
            const prev = acc.at(-1)
            if (prev && startLine <= prev[1]) {
              prev[1] = Math.max(prev[1], endLine)
            } else {
              acc.push([startLine, endLine])
            }
            return acc
          }, [])
          .map(([s, e]) => `${s}-${e}`)
          .join(', ')
      }

      function compactFileRanges(ranges: Ranges): string {
        const grouped = Map.groupBy(ranges, (r) => r.filePath)
        return [...grouped.entries()]
          .map(([file, rs]) => `${file}: ${mergeRanges(rs!)}`)
          .join('\n')
      }

      return {
        compactFileRanges,
      } as const
    },
  },
) {}

type Ranges = ReadonlyArray<{
  filePath: string
  startLine: number
  endLine: number
}>
