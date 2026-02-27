import { GrepAi } from '@grepai/core'
import * as Layer from 'effect/Layer'

import { Clack } from '../clack'

import { CommandUtils } from './services/command-utils'
import * as ConfigJson from './services/config-json'

export const layer = (project: string) =>
  Layer.mergeAll(GrepAi.Default, CommandUtils.Default, Clack.Default).pipe(
    Layer.provideMerge(ConfigJson.layer(project)),
  )
