import * as Schema from 'effect/Schema'

export class VercelAiError extends Schema.TaggedError<VercelAiError>()(
  'VercelAiError',
  {
    cause: Schema.Defect,
  },
) {}

export class MissingEnv extends Schema.TaggedError<MissingEnv>()('MissingEnv', {
  env: Schema.String,
}) {}

export class ConfigLoaderError extends Schema.TaggedError<ConfigLoaderError>()(
  'ConfigLoaderError',
  {
    cause: Schema.Defect,
  },
) {}
