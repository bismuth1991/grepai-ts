import type { SupportedLanguage } from '../domain'

import { BunContext } from '@effect/platform-bun'
import { describe, it, assert } from '@effect/vitest'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

import { ExportExtractor } from '../domain/export-extractor'
import { AstParser } from '../internal/services/ast-parser-v2'
import { ExportExtractorAst } from '../internal/services/export-extractor-ast'

const TestLive = ExportExtractorAst.pipe(
  Layer.provide(AstParser.Default),
  Layer.provideMerge(BunContext.layer),
)

const extractExports = (input: {
  content: string
  language: SupportedLanguage
}) =>
  Effect.gen(function* () {
    const extractor = yield* ExportExtractor
    return yield* extractor.extract(input)
  })

const normalize = (values: ReadonlyArray<string>) => [...values].sort()

describe('ExportExtractorAst', () => {
  describe('TypeScript', () => {
    it.effect('extracts named exports without alias', () =>
      Effect.gen(function* () {
        const code = `
export { foo, bar }
`
        const result = yield* extractExports({
          content: code,
          language: 'typescript',
        })

        assert.deepStrictEqual(normalize(result), normalize(['foo', 'bar']))
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('extracts named exports with alias', () =>
      Effect.gen(function* () {
        const code = `
export { foo as bar, baz as qux }
`
        const result = yield* extractExports({
          content: code,
          language: 'typescript',
        })

        assert.deepStrictEqual(normalize(result), normalize(['bar', 'qux']))
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('extracts default exports', () =>
      Effect.gen(function* () {
        const code = `
export default function myFunc() {}
`
        const result = yield* extractExports({
          content: code,
          language: 'typescript',
        })

        assert.deepStrictEqual(
          normalize(result),
          normalize(['default', 'myFunc']),
        )
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('extracts exported functions', () =>
      Effect.gen(function* () {
        const code = `
export function myFunction() {}
export async function asyncFunction() {}
`
        const result = yield* extractExports({
          content: code,
          language: 'typescript',
        })

        assert.deepStrictEqual(
          normalize(result),
          normalize(['myFunction', 'asyncFunction']),
        )
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('extracts exported classes', () =>
      Effect.gen(function* () {
        const code = `
export class MyClass {}
export class AnotherClass extends BaseClass {}
`
        const result = yield* extractExports({
          content: code,
          language: 'typescript',
        })

        assert.deepStrictEqual(
          normalize(result),
          normalize(['MyClass', 'AnotherClass']),
        )
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('extracts exported abstract classes', () =>
      Effect.gen(function* () {
        const code = `
export abstract class AbstractBase {}
`
        const result = yield* extractExports({
          content: code,
          language: 'typescript',
        })

        assert.deepStrictEqual(result, ['AbstractBase'])
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('extracts exported interfaces', () =>
      Effect.gen(function* () {
        const code = `
export interface MyInterface {
  name: string
}
export interface AnotherInterface<T> {
  value: T
}
`
        const result = yield* extractExports({
          content: code,
          language: 'typescript',
        })

        assert.deepStrictEqual(
          normalize(result),
          normalize(['MyInterface', 'AnotherInterface']),
        )
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('extracts exported type aliases', () =>
      Effect.gen(function* () {
        const code = `
export type MyType = string | number
export type GenericType<T> = T | null
`
        const result = yield* extractExports({
          content: code,
          language: 'typescript',
        })

        assert.deepStrictEqual(
          normalize(result),
          normalize(['MyType', 'GenericType']),
        )
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('extracts exported enums', () =>
      Effect.gen(function* () {
        const code = `
export enum Color {
  Red,
  Green,
  Blue
}
export const enum Direction {
  Up,
  Down
}
`
        const result = yield* extractExports({
          content: code,
          language: 'typescript',
        })

        assert.deepStrictEqual(
          normalize(result),
          normalize(['Color', 'Direction']),
        )
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('extracts exported const declarations', () =>
      Effect.gen(function* () {
        const code = `
export const myConst = 42
export let myLet = 'hello'
`
        const result = yield* extractExports({
          content: code,
          language: 'typescript',
        })

        assert.deepStrictEqual(
          normalize(result),
          normalize(['myConst', 'myLet']),
        )
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('extracts exported var declarations', () =>
      Effect.gen(function* () {
        const code = `
export var myVar = true
`
        const result = yield* extractExports({
          content: code,
          language: 'typescript',
        })

        assert.deepStrictEqual(result, ['myVar'])
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('extracts exported destructured objects', () =>
      Effect.gen(function* () {
        const code = `
export const { a, b, c } = obj
`
        const result = yield* extractExports({
          content: code,
          language: 'typescript',
        })

        assert.deepStrictEqual(normalize(result), normalize(['a', 'b', 'c']))
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('extracts exported destructured arrays', () =>
      Effect.gen(function* () {
        const code = `
export const [first, second] = arr
`
        const result = yield* extractExports({
          content: code,
          language: 'typescript',
        })

        assert.deepStrictEqual(
          normalize(result),
          normalize(['first', 'second']),
        )
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('extracts mixed export forms', () =>
      Effect.gen(function* () {
        const code = `
export { foo, bar as baz }
export default class MyClass {}
export function myFunc() {}
export const MY_CONST = 1
export interface MyInterface {}
export type MyType = string
export enum MyEnum { A, B }
`
        const result = yield* extractExports({
          content: code,
          language: 'typescript',
        })

        assert.deepStrictEqual(
          normalize(result),
          normalize([
            'foo',
            'baz',
            'default',
            'MyClass',
            'myFunc',
            'MY_CONST',
            'MyInterface',
            'MyType',
            'MyEnum',
          ]),
        )
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('dedupes repeated exports', () =>
      Effect.gen(function* () {
        const code = `
export { foo }
export { foo }
`
        const result = yield* extractExports({
          content: code,
          language: 'typescript',
        })

        assert.deepStrictEqual(result, ['foo'])
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('returns empty array when there are no exports', () =>
      Effect.gen(function* () {
        const code = `
import { something } from 'somewhere'
const internal = 42
function helper() {}
`
        const result = yield* extractExports({
          content: code,
          language: 'typescript',
        })

        assert.deepStrictEqual(result, [])
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles empty file', () =>
      Effect.gen(function* () {
        const code = ``
        const result = yield* extractExports({
          content: code,
          language: 'typescript',
        })

        assert.deepStrictEqual(result, [])
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('TSX', () => {
    it.effect('extracts exports from TSX files', () =>
      Effect.gen(function* () {
        const code = `
export const MyComponent = () => <div>Hello</div>
export function AnotherComponent({ name }: { name: string }) {
  return <span>{name}</span>
}
export default function App() {
  return <MyComponent />
}
`
        const result = yield* extractExports({
          content: code,
          language: 'tsx',
        })

        assert.deepStrictEqual(
          normalize(result),
          normalize(['MyComponent', 'AnotherComponent', 'default', 'App']),
        )
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('extracts type exports from TSX', () =>
      Effect.gen(function* () {
        const code = `
export interface Props {
  title: string
}
export type ButtonProps = {
  onClick: () => void
}
export const Button = ({ onClick }: ButtonProps) => <button onClick={onClick} />
`
        const result = yield* extractExports({
          content: code,
          language: 'tsx',
        })

        assert.deepStrictEqual(
          normalize(result),
          normalize(['Props', 'ButtonProps', 'Button']),
        )
      }).pipe(Effect.provide(TestLive)),
    )
  })
})
