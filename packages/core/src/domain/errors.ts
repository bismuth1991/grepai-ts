import * as Schema from 'effect/Schema'

export class VercelAiError extends Schema.TaggedError<VercelAiError>()(
  'VercelAiError',
  {
    cause: Schema.Defect,
  },
) {}
