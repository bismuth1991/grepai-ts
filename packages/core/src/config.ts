import * as Schema from 'effect/Schema'
import { GrepAiConfig } from './domain/config'

export function env(key: string) {
  return Schema.decodeUnknownSync(Schema.String)(process.env[key])
}

export function defineConfig(config: GrepAiConfig) {
  return config
}

export { type GrepAiConfig } from './domain/config'
