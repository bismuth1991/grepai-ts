import * as Schema from 'effect/Schema'

const SupportedLanguage = Schema.Literal(
  'typescript',
  'tsx',
  'json',
  'javascript',
  'java',
  'yaml',
  'prisma',
)
export type SupportedLanguage = typeof SupportedLanguage.Type

export * from './errors'

export { GrepAiConfig, Config } from './config'
