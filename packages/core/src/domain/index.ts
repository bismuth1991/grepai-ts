import * as Schema from 'effect/Schema'

const SupportedLanguage = Schema.Literal('typescript', 'tsx', 'json')
export type SupportedLanguage = typeof SupportedLanguage.Type

export * from './errors'
