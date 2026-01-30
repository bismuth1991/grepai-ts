import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { embedMany, generateText } from 'ai'
import * as Effect from 'effect/Effect'

import { Config } from '../../domain/config'
import { VercelAiError } from '../../domain/errors'

import { ConfigJson } from './config-json'

export class VercelAi extends Effect.Service<VercelAi>()(
  '@grepai/core/internal/services/vercel-ai/VercelAi',
  {
    dependencies: [ConfigJson],
    effect: Effect.gen(function* () {
      const config = yield* Config

      const google = createGoogleGenerativeAI({
        apiKey: config.embedding.apiKey,
      })

      const ai = {
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
  embedMany: typeof embedMany
  generateText: typeof generateText
  google: ReturnType<typeof createGoogleGenerativeAI>
}
