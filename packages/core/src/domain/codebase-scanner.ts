import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'

import { CodebaseScannerError } from './errors'

export class CodebaseScanner extends Context.Tag(
  '@grepai/core/domain/codebase-scanner/CodebaseScanner',
)<
  CodebaseScanner,
  {
    scan: () => Effect.Effect<Array<string>, CodebaseScannerError, never>
  }
>() {}
