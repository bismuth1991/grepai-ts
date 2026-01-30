import { Command, CommandExecutor } from '@effect/platform'
import * as Effect from 'effect/Effect'
import * as String from 'effect/String'

export class Git extends Effect.Service<Git>()(
  '@grepai/scripts/internal/services/git',
  {
    effect: Effect.gen(function* () {
      const executor = yield* CommandExecutor.CommandExecutor

      const getStagedDiff = () =>
        Command.make(
          'git',
          'diff',
          '--staged',
          '-U50',
          '--',
          '.',
          ':(exclude)bun.lock',
        ).pipe(executor.string, Effect.map(String.trim))

      const commit = (message: string) =>
        Command.make('git', 'commit', '-m', message).pipe(
          Command.stdout('inherit'),
          Command.stderr('inherit'),
          executor.exitCode,
        )

      return {
        getStagedDiff,
        commit,
      } as const
    }),
  },
) {}
