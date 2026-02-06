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

export class DocumentStorageError extends Schema.TaggedError<DocumentStorageError>()(
  'DocumentStorageError',
  {
    cause: Schema.Defect,
  },
) {}

export class DocumentNotFound extends Schema.TaggedError<DocumentNotFound>()(
  'DocumentNotFound',
  {
    filePath: Schema.String,
  },
) {}

export class TokenCounterError extends Schema.TaggedError<TokenCounterError>()(
  'TokenCounterError',
  {
    cause: Schema.Defect,
  },
) {}

export class AstParserError extends Schema.TaggedError<AstParserError>()(
  'AstParserError',
  {
    cause: Schema.Defect,
  },
) {}

export class LanguageNotSupported extends Schema.TaggedError<LanguageNotSupported>()(
  'LanguageNotSupported',
  {
    cause: Schema.Defect,
  },
) {}

export class CodebaseScannerError extends Schema.TaggedError<CodebaseScannerError>()(
  'CodebaseScannerError',
  {
    cause: Schema.Defect,
  },
) {}

export class ChunkerError extends Schema.TaggedError<ChunkerError>()(
  'ChunkerError',
  {
    cause: Schema.Defect,
  },
) {}

export class TokenCounterCacheError extends Schema.TaggedError<TokenCounterCacheError>()(
  'TokenCounterCacheError',
  {
    cause: Schema.Defect,
  },
) {}

export class EmbeddingCacheError extends Schema.TaggedError<EmbeddingCacheError>()(
  'EmbeddingCacheError',
  {
    cause: Schema.Defect,
  },
) {}

export class EmbeddingError extends Schema.TaggedError<EmbeddingError>()(
  'EmbeddingError',
  {
    cause: Schema.Defect,
  },
) {}
