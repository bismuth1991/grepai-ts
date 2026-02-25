import { FileSystem, Path } from '@effect/platform'
import { connect } from '@tursodatabase/sync'
import { AgentFS } from 'agentfs-sdk'
import * as Effect from 'effect/Effect'

import { Config } from '../../domain/config'
import { AgentFsError } from '../../domain/errors'

export class AgentFs extends Effect.Service<AgentFs>()(
  '@grepai/core/internal/services/agentfs',
  {
    scoped: Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const config = yield* Config

      if (!config.experimental__agentFs) {
        return yield* new AgentFsError({
          cause: '`experimental__agentFs` is not enabled.',
        })
      }

      const { authToken, url, syncMode } = config.experimental__agentFs
      const baseAgentFsLocalPath = path.resolve(config.cwd, './.grepai/agentfs')

      yield* fs.makeDirectory(baseAgentFsLocalPath, { recursive: true })

      const db = yield* Effect.tryPromise({
        try: async () => {
          const db = await connect({
            path: path.join(baseAgentFsLocalPath, 'local.db'),
            url,
            authToken,
            clientName: 'grepai',
          })
          if (syncMode === 'pull') {
            await db.pull().catch((e) => {
              if (
                e instanceof Error &&
                e.message.includes('File is locked by another process')
              ) {
                return
              }
              throw e
            })
          }
          return db
        },
        catch: (cause) => new AgentFsError({ cause }),
      })

      const agentFs = yield* Effect.tryPromise({
        try: () => AgentFS.openWith(db),
        catch: (cause) => new AgentFsError({ cause }),
      })

      yield* Effect.addFinalizer(() => Effect.promise(() => agentFs.close()))

      const use = <T>(f: (af: typeof agentFs) => Promise<T>) =>
        Effect.tryPromise({
          try: () => f(agentFs),
          catch: (cause) => new AgentFsError({ cause }),
        })

      const dbPull = () =>
        Effect.tryPromise({
          try: () => db.pull(),
          catch: (cause) => new AgentFsError({ cause }),
        })

      const dbPush = () =>
        Effect.tryPromise({
          try: () => db.push(),
          catch: (cause) => new AgentFsError({ cause }),
        })

      return {
        use,
        dbPull,
        dbPush,
      } as const
    }),
  },
) {}
