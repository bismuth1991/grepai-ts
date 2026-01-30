import { BunContext, BunRuntime } from '@effect/platform-bun'
import * as Effect from 'effect/Effect'

import { buildConfigJsonSchema } from './build-config-json-schema'

// @effect-diagnostics-next-line unnecessaryEffectGen:off
const build = Effect.gen(function* () {
  yield* buildConfigJsonSchema()
})

build.pipe(Effect.provide(BunContext.layer), BunRuntime.runMain)
