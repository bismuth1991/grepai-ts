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

      const db = yield* Effect.firstSuccessOf([
        Effect.tryPromise({
          try: () =>
            connect({
              path: path.join(baseAgentFsLocalPath, 'local.db'),
              url,
              authToken,
              clientName: 'grepai',
            }),
          catch: (cause) => new AgentFsError({ cause }),
        }),
        Effect.tryPromise({
          try: () =>
            connect({
              path: ':memory:',
              url,
              authToken,
              clientName: 'grepai',
            }),
          catch: (cause) => new AgentFsError({ cause }),
        }),
      ])

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
          try: async () => {
            if (syncMode === 'pull') {
              return db.pull()
            }
            throw new Error(
              '`experimental__agentFs.syncMode` is not set to "pull"',
            )
          },
          catch: (cause) => new AgentFsError({ cause }),
        })

      const dbPush = () =>
        Effect.tryPromise({
          try: async () => {
            if (syncMode === 'push') {
              return db.push()
            }
            throw new Error(
              '`experimental__agentFs.syncMode` is not set to "push"',
            )
          },
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
