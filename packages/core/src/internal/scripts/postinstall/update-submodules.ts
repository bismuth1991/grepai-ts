import { Command } from '@effect/platform'
import * as Effect from 'effect/Effect'

export const updateSubmodules = Effect.fnUntraced(function* () {
  yield* Command.make('git', 'submodule', 'update', '--remote', '--force').pipe(
    Command.stdout('inherit'),
    Command.stderr('inherit'),
    Command.exitCode,
  )
})
