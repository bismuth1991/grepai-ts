import * as clack from '@clack/prompts'
import { IndexerCallbackError } from '@grepai/core/domain'
import * as Effect from 'effect/Effect'

export class Clack extends Effect.Service<Clack>()('@grepai/cli/clack', {
  scoped: Effect.gen(function* () {
    const useClack = <T>(f: (p: typeof clack) => Promise<T> | T) =>
      Effect.tryPromise({
        try: () => {
          const result = f(clack)
          if (result instanceof Promise) {
            return result
          }
          return Promise.resolve(result)
        },
        catch: (cause) => new IndexerCallbackError({ cause }),
      })

    const spinner = yield* useClack((clack) => clack.spinner())

    const useSpinner = <T>(f: (p: typeof spinner) => T) =>
      Effect.try({
        try: () => f(spinner),
        catch: (cause) => new IndexerCallbackError({ cause }),
      })

    const intro = Effect.fnUntraced(function* (intro: string) {
      yield* useClack((clack) => clack.intro(intro))
    })
    const outro = Effect.fnUntraced(function* (outro: string) {
      yield* useClack((clack) => clack.outro(outro))
    })
    const note = Effect.fnUntraced(function* (message: string, title: string) {
      yield* useClack((clack) => clack.note(message, title))
    })

    const spinnerStart = Effect.fnUntraced(function* (message?: string) {
      yield* useSpinner((spinner) => spinner.start(message))
    })
    const spinnerMessage = Effect.fnUntraced(function* (message: string) {
      yield* useSpinner((spinner) => spinner.message(message))
    })
    const spinnerStop = Effect.fnUntraced(function* (message?: string) {
      yield* useSpinner((spinner) => spinner.stop(message))
    })

    yield* Effect.addFinalizer(() => spinnerStop().pipe(Effect.orDie))

    return {
      intro,
      outro,
      note,
      spinner: {
        start: spinnerStart,
        message: spinnerMessage,
        stop: spinnerStop,
      },
    } as const
  }),
}) {}
