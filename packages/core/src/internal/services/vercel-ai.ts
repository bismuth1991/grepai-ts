import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText, jsonSchema } from 'ai'
import * as Config from 'effect/Config'
import * as Effect from 'effect/Effect'
import * as Redacted from 'effect/Redacted'

import { VercelAiError } from '../../domain/errors'

export class VercelAi extends Effect.Service<VercelAi>()(
  '@grepai/core/internal/services/vercel-ai/VercelAi',
  {
    effect: Effect.gen(function* () {
      const apiKey = yield* Config.redacted('GEMINI_API_KEY')

      const google = createGoogleGenerativeAI({
        apiKey: Redacted.value(apiKey),
      })

      const ai = {
        generateText,
        google,
        jsonSchema,
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
  generateText: typeof generateText
  google: ReturnType<typeof createGoogleGenerativeAI>
  jsonSchema: typeof jsonSchema
}
