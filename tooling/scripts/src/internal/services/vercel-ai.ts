import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { embed, embedMany, generateText } from 'ai'
import * as Config from 'effect/Config'
import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'

class VercelAiError extends Schema.TaggedError<VercelAiError>()(
  'VercelAiError',
  { cause: Schema.Defect },
) {}

export class VercelAi extends Effect.Service<VercelAi>()(
  '@grepai/core/internal/services/vercel-ai/VercelAi',
  {
    effect: Effect.gen(function* () {
      const geminiApiKey = yield* Config.string('GEMINI_API_KEY')

      const google = createGoogleGenerativeAI({
        apiKey: geminiApiKey,
      })

      const ai = {
        embed,
        embedMany,
        generateText,
        google,
      }

      const use = <T>(f: (ai: Ai) => Promise<T>) =>
        Effect.tryPromise({
          try: () => f(ai),
          catch: (cause) => new VercelAiError({ cause }),
        })

      return { use } as const
    }),
  },
) {}

type Ai = {
  embed: typeof embed
  embedMany: typeof embedMany
  generateText: typeof generateText
  google: ReturnType<typeof createGoogleGenerativeAI>
}
