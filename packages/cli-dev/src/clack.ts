import * as clack from '@clack/prompts'
import { IndexerCallbackError } from '@grepai/core/domain'
import * as Effect from 'effect/Effect'

export class Clack extends Effect.Service<Clack>()('@grepai/cli/clack', {
  effect: Effect.gen(function* () {
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
    const throttledSpinnerMessage = throttleSync(spinner.message, 2000)
    const _spinner = {
      ...spinner,
      message: throttledSpinnerMessage,
    }

    const useSpinner = <T>(f: (p: typeof _spinner) => T) =>
      Effect.try({
        try: () => f(_spinner),
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

function throttleSync<T extends (...args: any[]) => any>(
  fn: T,
  interval: number,
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  let lastCalledAt = 0

  return (...args: Parameters<T>): ReturnType<T> | undefined => {
    const now = Date.now()

    if (now - lastCalledAt >= interval) {
      lastCalledAt = now
      return fn(...args)
    }

    return void 0
  }
}
