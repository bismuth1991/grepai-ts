import type { SupportedLanguage } from '../domain'

import { BunContext } from '@effect/platform-bun'
import { describe, it, assert } from '@effect/vitest'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

import { ImportExtractor } from '../domain/import-extractor'
import { AstParser } from '../internal/services/ast-parser-v2'
import { ImportExtractorAst } from '../internal/services/import-extractor-ast'

const TestLive = ImportExtractorAst.pipe(
  Layer.provide(AstParser.Default),
  Layer.provideMerge(BunContext.layer),
)

const extractImports = (input: {
  content: string
  language: SupportedLanguage
}) =>
  Effect.gen(function* () {
    const extractor = yield* ImportExtractor
    return yield* extractor.extract(input)
  })

const normalize = (values: ReadonlyArray<string>) => [...values].sort()

describe('ImportExtractorAst', () => {
  describe('Typescript', () => {
    it.effect('extracts supported import forms', () =>
      Effect.gen(function* () {
        const code = `
import React from 'react'
import * as Effect from 'effect'
import { foo, bar as baz } from 'mod'
import fs = require('fs')
import Alias = Namespace.Sub
import 'side-effect'
`
        const result = yield* extractImports({
          content: code,
          language: 'typescript',
        })

        assert.deepStrictEqual(
          normalize(result),
          normalize(['React', 'Effect', 'foo', 'baz', 'fs', 'Alias']),
        )
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('dedupes repeated imports', () =>
      Effect.gen(function* () {
        const code = `
import { foo } from 'a'
import { foo } from 'a'
`
        const result = yield* extractImports({
          content: code,
          language: 'typescript',
        })

        assert.deepStrictEqual(result, ['foo'])
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('ignores side-effect imports', () =>
      Effect.gen(function* () {
        const code = `import 'side-effect'`
        const result = yield* extractImports({
          content: code,
          language: 'typescript',
        })

        assert.deepStrictEqual(result, [])
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('works when there are no imports', () =>
      Effect.gen(function* () {
        const code = `
export function helloWorld() {
  console.log('Hello, world!');
}
`
        const result = yield* extractImports({
          content: code,
          language: 'typescript',
        })

        assert.deepStrictEqual(result, [])
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('TSX', () => {
    it.effect('extracts imports alongside JSX', () =>
      Effect.gen(function* () {
        const code = `
import React from 'react'
import * as Icons from './icons'
import { Button as PrimaryButton, Label } from './ui'

export function App() {
  return (
    <div>
      <PrimaryButton />
      <Icons.Close />
      <Label text="hi" />
    </div>
  )
}
`
        const result = yield* extractImports({
          content: code,
          language: 'tsx',
        })

        assert.deepStrictEqual(
          normalize(result),
          normalize(['React', 'Icons', 'PrimaryButton', 'Label']),
        )
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('extracts TypeScript-style imports in TSX', () =>
      Effect.gen(function* () {
        const code = `
import fs = require('fs')
import Alias = Namespace.Sub
import { helper } from './helpers'

const View = () => <span>{helper(fs, Alias)}</span>

export default View
`
        const result = yield* extractImports({
          content: code,
          language: 'tsx',
        })

        assert.deepStrictEqual(
          normalize(result),
          normalize(['fs', 'Alias', 'helper']),
        )
      }).pipe(Effect.provide(TestLive)),
    )
  })
})
