import { Command, Prompt } from '@effect/cli'
import { FileSystem } from '@effect/platform'
import { VercelAi } from '@grepai/core/vercel-ai'
import * as Effect from 'effect/Effect'
import * as String from 'effect/String'

import { Git } from './services/git'

export const git = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const git = yield* Git
  const ai = yield* VercelAi

  const commit = Command.make('commit').pipe(
    Command.withHandler(
      Effect.fnUntraced(function* () {
        const stagedDiff = yield* git.getStagedDiff()

        if (String.isEmpty(stagedDiff)) {
          return yield* Effect.logInfo(
            'No staged changes found. Nothing to commit.',
          )
        }

        const prompt = yield* fs
          .readFileString(
            'tooling/scripts/src/internal/fs/make-commit-message-prompt.md',
          )
          .pipe(Effect.map(String.concat(`\n${stagedDiff}`)))

        const commitMessage = yield* ai
          .use(({ generateText, google }) =>
            generateText({
              model: google('gemini-3-flash-preview'),
              prompt,
            }),
          )
          .pipe(Effect.map((res) => res.text))

        yield* Effect.logInfo(`\n\n${commitMessage}\n`)

        const confirm = yield* Prompt.confirm({
          message: 'Would you like to commit with this message?',
        })

        if (confirm) {
          yield* git.commit(commitMessage)
          yield* Effect.log('✅ Successfully committed changes!')
        }
      }),
    ),
  )

  return Command.make('git').pipe(Command.withSubcommands([commit]))
})
