import { BunRuntime } from '@effect/platform-bun'
import * as Effect from 'effect/Effect'

Effect.logInfo('Hello, World!').pipe(BunRuntime.runMain)
