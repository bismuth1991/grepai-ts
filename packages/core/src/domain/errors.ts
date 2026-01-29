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

export class SchemaValidationFailed extends Schema.TaggedError<SchemaValidationFailed>()(
  'SchemaValidationFailed',
  {
    cause: Schema.Defect,
    description: Schema.String.pipe(
      Schema.optional,
      Schema.withConstructorDefault(
        () =>
          'Schema validation failed. This indicates a schema mismatch between code and database.',
      ),
    ),
  },
) {}
