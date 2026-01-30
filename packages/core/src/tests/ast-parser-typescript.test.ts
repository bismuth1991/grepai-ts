import { FileSystem } from '@effect/platform'
import { BunContext } from '@effect/platform-bun'
import { describe, it, assert } from '@effect/vitest'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

import { AstLanguageConfig, AstParser } from '../internal/services/ast-parser'

const TestLive = AstParser.Default.pipe(
  Layer.provide(AstLanguageConfig.Default),
  Layer.provideMerge(BunContext.layer),
)

const parseTypeScriptCode = (code: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const astParser = yield* AstParser

    const tmpFile = yield* fs.makeTempFileScoped({ suffix: '.ts' })
    yield* fs.writeFileString(tmpFile, code)

    return yield* astParser.extractNodesForChunking(tmpFile)
  })

const findCaptures = (
  results: Array<Array<{ name: string; node: { text: string; type: string } }>>,
  captureName: string,
) => {
  return results.flatMap((captures) =>
    captures.filter((c) => c.name === captureName).map((c) => c.node.text),
  )
}

const findNames = (
  results: Array<Array<{ name: string; node: { text: string; type: string } }>>,
) => findCaptures(results, 'name')

const findItems = (
  results: Array<Array<{ name: string; node: { text: string; type: string } }>>,
) => findCaptures(results, 'item')

const findContexts = (
  results: Array<Array<{ name: string; node: { text: string; type: string } }>>,
) => findCaptures(results, 'context')

describe('AstParserTypeScript', () => {
  describe('imports', () => {
    it.scoped('captures import statements', () =>
      Effect.gen(function* () {
        const code = `
import { foo, bar } from 'module'
import * as ns from 'namespace'
import defaultExport from 'default-mod'
import 'side-effect'
`
        const results = yield* parseTypeScriptCode(code)
        const items = findItems(results)

        assert.strictEqual(items.length, 4)
        assert.isTrue(
          items.some((i) => i.includes("import { foo, bar } from 'module'")),
        )
        assert.isTrue(
          items.some((i) => i.includes("import * as ns from 'namespace'")),
        )
        assert.isTrue(
          items.some((i) =>
            i.includes("import defaultExport from 'default-mod'"),
          ),
        )
        assert.isTrue(items.some((i) => i.includes("import 'side-effect'")))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures import x = require as import_statement', () =>
      Effect.gen(function* () {
        const code = `
import fs = require('fs')
import path = require('path')
`
        const results = yield* parseTypeScriptCode(code)
        const items = findItems(results)

        assert.strictEqual(items.length, 2)
        assert.isTrue(items.some((i) => i.includes('fs')))
        assert.isTrue(items.some((i) => i.includes('path')))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures import alias (namespace reference)', () =>
      Effect.gen(function* () {
        const code = `import MyAlias = SomeNamespace.Nested`
        const results = yield* parseTypeScriptCode(code)
        const names = findNames(results)

        assert.isTrue(names.includes('MyAlias'))
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('exports and re-exports', () => {
    it.scoped('captures export clause (named exports)', () =>
      Effect.gen(function* () {
        const code = `export { a, b, c }`
        const results = yield* parseTypeScriptCode(code)
        const items = findItems(results)
        const contexts = findContexts(results)

        assert.strictEqual(items.length, 1)
        assert.isTrue(items[0]!.includes('export { a, b, c }'))
        assert.isTrue(contexts.includes('export'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures export with renaming', () =>
      Effect.gen(function* () {
        const code = `export { foo as bar, baz as qux }`
        const results = yield* parseTypeScriptCode(code)
        const items = findItems(results)

        assert.strictEqual(items.length, 1)
        assert.isTrue(items[0]!.includes('export { foo as bar, baz as qux }'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures export * from (re-export all)', () =>
      Effect.gen(function* () {
        const code = `export * from 'some-module'`
        const results = yield* parseTypeScriptCode(code)
        const items = findItems(results)
        const contexts = findContexts(results)

        assert.strictEqual(items.length, 1)
        assert.isTrue(items[0]!.includes("export * from 'some-module'"))
        assert.isTrue(contexts.includes('export'))
        assert.isTrue(contexts.includes('*'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures export default expression', () =>
      Effect.gen(function* () {
        const code = `export default { key: 'value' }`
        const results = yield* parseTypeScriptCode(code)
        const items = findItems(results)
        const contexts = findContexts(results)

        assert.strictEqual(items.length, 1)
        assert.isTrue(contexts.includes('export'))
        assert.isTrue(contexts.includes('default'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures export default function with name', () =>
      Effect.gen(function* () {
        const code = `export default function myFunc() { return 42 }`
        const results = yield* parseTypeScriptCode(code)
        const items = findItems(results)
        const names = findNames(results)
        const contexts = findContexts(results)

        assert.isTrue(items.length >= 1)
        assert.isTrue(names.includes('myFunc'))
        assert.isTrue(contexts.includes('export'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures export default function without name', () =>
      Effect.gen(function* () {
        const code = `export default function() { return 42 }`
        const results = yield* parseTypeScriptCode(code)
        const items = findItems(results)
        const contexts = findContexts(results)

        assert.strictEqual(items.length, 1)
        assert.isTrue(contexts.includes('export'))
        assert.isTrue(contexts.includes('default'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures export default class with name', () =>
      Effect.gen(function* () {
        const code = `export default class MyClass {}`
        const results = yield* parseTypeScriptCode(code)
        const items = findItems(results)
        const names = findNames(results)
        const contexts = findContexts(results)

        assert.isTrue(items.length >= 1)
        assert.isTrue(names.includes('MyClass'))
        assert.isTrue(contexts.includes('export'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures export default class without name', () =>
      Effect.gen(function* () {
        const code = `export default class {}`
        const results = yield* parseTypeScriptCode(code)
        const items = findItems(results)
        const contexts = findContexts(results)

        assert.strictEqual(items.length, 1)
        assert.isTrue(contexts.includes('export'))
        assert.isTrue(contexts.includes('default'))
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('exported declarations', () => {
    it.scoped('captures export function', () =>
      Effect.gen(function* () {
        const code = `export function greet(name: string): string { return name }`
        const results = yield* parseTypeScriptCode(code)
        const items = findItems(results)
        const names = findNames(results)
        const contexts = findContexts(results)

        assert.strictEqual(items.length, 1)
        assert.isTrue(names.includes('greet'))
        assert.isTrue(contexts.includes('export'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures export class', () =>
      Effect.gen(function* () {
        const code = `export class UserService { constructor() {} }`
        const results = yield* parseTypeScriptCode(code)
        const items = findItems(results)
        const names = findNames(results)
        const contexts = findContexts(results)

        assert.strictEqual(items.length, 1)
        assert.isTrue(names.includes('UserService'))
        assert.isTrue(contexts.includes('export'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures export class with decorator', () =>
      Effect.gen(function* () {
        const code = `@Injectable()
export class AuthService {}`
        const results = yield* parseTypeScriptCode(code)
        const items = findItems(results)
        const names = findNames(results)

        assert.strictEqual(items.length, 1)
        assert.isTrue(names.includes('AuthService'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures export abstract class', () =>
      Effect.gen(function* () {
        const code = `export abstract class BaseEntity { abstract getId(): string }`
        const results = yield* parseTypeScriptCode(code)
        const items = findItems(results)
        const names = findNames(results)
        const contexts = findContexts(results)

        assert.strictEqual(items.length, 1)
        assert.isTrue(names.includes('BaseEntity'))
        assert.isTrue(contexts.includes('export'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures export interface', () =>
      Effect.gen(function* () {
        const code = `export interface User { id: string; name: string }`
        const results = yield* parseTypeScriptCode(code)
        const items = findItems(results)
        const names = findNames(results)
        const contexts = findContexts(results)

        assert.strictEqual(items.length, 1)
        assert.isTrue(names.includes('User'))
        assert.isTrue(contexts.includes('export'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures export type', () =>
      Effect.gen(function* () {
        const code = `export type UserId = string | number`
        const results = yield* parseTypeScriptCode(code)
        const items = findItems(results)
        const names = findNames(results)
        const contexts = findContexts(results)

        assert.strictEqual(items.length, 1)
        assert.isTrue(names.includes('UserId'))
        assert.isTrue(contexts.includes('export'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures export enum', () =>
      Effect.gen(function* () {
        const code = `export enum Status { Active, Inactive, Pending }`
        const results = yield* parseTypeScriptCode(code)
        const items = findItems(results)
        const names = findNames(results)
        const contexts = findContexts(results)

        assert.strictEqual(items.length, 1)
        assert.isTrue(names.includes('Status'))
        assert.isTrue(contexts.includes('export'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures export const', () =>
      Effect.gen(function* () {
        const code = `export const API_URL = 'https://api.example.com'`
        const results = yield* parseTypeScriptCode(code)
        const items = findItems(results)
        const names = findNames(results)
        const contexts = findContexts(results)

        assert.strictEqual(items.length, 1)
        assert.isTrue(names.includes('API_URL'))
        assert.isTrue(contexts.includes('export'))
        assert.isTrue(contexts.includes('const'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures export let', () =>
      Effect.gen(function* () {
        const code = `export let counter = 0`
        const results = yield* parseTypeScriptCode(code)
        const items = findItems(results)
        const names = findNames(results)
        const contexts = findContexts(results)

        assert.strictEqual(items.length, 1)
        assert.isTrue(names.includes('counter'))
        assert.isTrue(contexts.includes('export'))
        assert.isTrue(contexts.includes('let'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures export var', () =>
      Effect.gen(function* () {
        const code = `export var legacy = 'value'`
        const results = yield* parseTypeScriptCode(code)
        const items = findItems(results)
        const names = findNames(results)
        const contexts = findContexts(results)

        assert.strictEqual(items.length, 1)
        assert.isTrue(names.includes('legacy'))
        assert.isTrue(contexts.includes('export'))
        assert.isTrue(contexts.includes('var'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures export = expr (TS export assignment)', () =>
      Effect.gen(function* () {
        const code = `export = { version: '1.0.0' }`
        const results = yield* parseTypeScriptCode(code)
        const items = findItems(results)
        const contexts = findContexts(results)

        assert.strictEqual(items.length, 1)
        assert.isTrue(contexts.includes('export'))
        assert.isTrue(contexts.includes('='))
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('namespaces and modules', () => {
    it.scoped('captures namespace declaration as expression_statement', () =>
      Effect.gen(function* () {
        const code = `namespace MyNamespace { export const value = 1 }`
        const results = yield* parseTypeScriptCode(code)
        const items = findItems(results)

        assert.isTrue(items.length >= 1)
        assert.isTrue(items.some((i) => i.includes('MyNamespace')))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped(
      'does not capture legacy module keyword (node type is module, not internal_module)',
      () =>
        Effect.gen(function* () {
          const code = `module LegacyModule { export const value = 1 }`
          const results = yield* parseTypeScriptCode(code)
          const items = findItems(results)

          assert.strictEqual(items.length, 0)
        }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('top-level types', () => {
    it.scoped('captures enum declaration', () =>
      Effect.gen(function* () {
        const code = `enum Color { Red, Green, Blue }`
        const results = yield* parseTypeScriptCode(code)
        const names = findNames(results)
        const contexts = findContexts(results)

        assert.isTrue(names.includes('Color'))
        assert.isTrue(contexts.includes('enum'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures const enum declaration', () =>
      Effect.gen(function* () {
        const code = `const enum Direction { Up, Down, Left, Right }`
        const results = yield* parseTypeScriptCode(code)
        const names = findNames(results)

        assert.isTrue(names.includes('Direction'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures interface declaration', () =>
      Effect.gen(function* () {
        const code = `interface Person { name: string; age: number }`
        const results = yield* parseTypeScriptCode(code)
        const names = findNames(results)
        const contexts = findContexts(results)

        assert.isTrue(names.includes('Person'))
        assert.isTrue(contexts.includes('interface'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures interface with extends', () =>
      Effect.gen(function* () {
        const code = `interface Employee extends Person { employeeId: string }`
        const results = yield* parseTypeScriptCode(code)
        const names = findNames(results)

        assert.isTrue(names.includes('Employee'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures type alias declaration', () =>
      Effect.gen(function* () {
        const code = `type Callback = (value: string) => void`
        const results = yield* parseTypeScriptCode(code)
        const names = findNames(results)
        const contexts = findContexts(results)

        assert.isTrue(names.includes('Callback'))
        assert.isTrue(contexts.includes('type'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures complex type alias', () =>
      Effect.gen(function* () {
        const code = `type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }`
        const results = yield* parseTypeScriptCode(code)
        const names = findNames(results)

        assert.isTrue(names.includes('Result'))
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('top-level classes', () => {
    it.scoped('captures class declaration', () =>
      Effect.gen(function* () {
        const code = `class Animal { constructor(public name: string) {} }`
        const results = yield* parseTypeScriptCode(code)
        const names = findNames(results)
        const contexts = findContexts(results)

        assert.isTrue(names.includes('Animal'))
        assert.isTrue(contexts.includes('class'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures class with decorator', () =>
      Effect.gen(function* () {
        const code = `@Component({ selector: 'app-root' })
class AppComponent {}`
        const results = yield* parseTypeScriptCode(code)
        const names = findNames(results)

        assert.isTrue(names.includes('AppComponent'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures abstract class declaration', () =>
      Effect.gen(function* () {
        const code = `abstract class Shape { abstract area(): number }`
        const results = yield* parseTypeScriptCode(code)
        const names = findNames(results)
        const contexts = findContexts(results)

        assert.isTrue(names.includes('Shape'))
        assert.isTrue(contexts.includes('abstract'))
        assert.isTrue(contexts.includes('class'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures abstract class with decorator', () =>
      Effect.gen(function* () {
        const code = `@Injectable()
abstract class BaseService { abstract execute(): void }`
        const results = yield* parseTypeScriptCode(code)
        const names = findNames(results)

        assert.isTrue(names.includes('BaseService'))
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('top-level functions', () => {
    it.scoped('captures regular function declaration', () =>
      Effect.gen(function* () {
        const code = `function add(a: number, b: number): number { return a + b }`
        const results = yield* parseTypeScriptCode(code)
        const names = findNames(results)
        const contexts = findContexts(results)

        assert.isTrue(names.includes('add'))
        assert.isTrue(contexts.includes('function'))
        assert.isTrue(contexts.includes('('))
        assert.isTrue(contexts.includes(')'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures async function declaration', () =>
      Effect.gen(function* () {
        const code = `async function fetchData(url: string): Promise<Response> { return fetch(url) }`
        const results = yield* parseTypeScriptCode(code)
        const names = findNames(results)
        const contexts = findContexts(results)

        assert.isTrue(names.includes('fetchData'))
        assert.isTrue(contexts.includes('async'))
        assert.isTrue(contexts.includes('function'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures generator function declaration', () =>
      Effect.gen(function* () {
        const code = `function* range(start: number, end: number) { for (let i = start; i < end; i++) yield i }`
        const results = yield* parseTypeScriptCode(code)
        const names = findNames(results)
        const contexts = findContexts(results)

        assert.isTrue(names.includes('range'))
        assert.isTrue(contexts.includes('function'))
        assert.isTrue(contexts.includes('*'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures async generator function declaration', () =>
      Effect.gen(function* () {
        const code = `async function* asyncRange(start: number, end: number) { for (let i = start; i < end; i++) yield i }`
        const results = yield* parseTypeScriptCode(code)
        const names = findNames(results)
        const contexts = findContexts(results)

        assert.isTrue(names.includes('asyncRange'))
        assert.isTrue(contexts.includes('async'))
        assert.isTrue(contexts.includes('function'))
        assert.isTrue(contexts.includes('*'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures function signature (overload)', () =>
      Effect.gen(function* () {
        const code = `function parse(value: string): number
function parse(value: number): string
function parse(value: string | number): number | string { return typeof value === 'string' ? parseInt(value) : String(value) }`
        const results = yield* parseTypeScriptCode(code)
        const names = findNames(results)

        const parseCount = names.filter((n) => n === 'parse').length
        assert.isTrue(parseCount >= 2)
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('top-level variables', () => {
    it.scoped('captures const declaration', () =>
      Effect.gen(function* () {
        const code = `const MAX_SIZE = 100`
        const results = yield* parseTypeScriptCode(code)
        const names = findNames(results)
        const contexts = findContexts(results)

        assert.isTrue(names.includes('MAX_SIZE'))
        assert.isTrue(contexts.includes('const'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures let declaration', () =>
      Effect.gen(function* () {
        const code = `let mutableValue = 'initial'`
        const results = yield* parseTypeScriptCode(code)
        const names = findNames(results)
        const contexts = findContexts(results)

        assert.isTrue(names.includes('mutableValue'))
        assert.isTrue(contexts.includes('let'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures var declaration', () =>
      Effect.gen(function* () {
        const code = `var legacyVar = 'old'`
        const results = yield* parseTypeScriptCode(code)
        const names = findNames(results)
        const contexts = findContexts(results)

        assert.isTrue(names.includes('legacyVar'))
        assert.isTrue(contexts.includes('var'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures destructuring assignment', () =>
      Effect.gen(function* () {
        const code = `const { a, b } = obj`
        const results = yield* parseTypeScriptCode(code)
        const items = findItems(results)

        assert.strictEqual(items.length, 1)
        assert.isTrue(items[0]!.includes('const { a, b } = obj'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures array destructuring', () =>
      Effect.gen(function* () {
        const code = `const [first, second] = arr`
        const results = yield* parseTypeScriptCode(code)
        const items = findItems(results)

        assert.strictEqual(items.length, 1)
        assert.isTrue(items[0]!.includes('const [first, second] = arr'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures arrow function const', () =>
      Effect.gen(function* () {
        const code = `const greet = (name: string) => \`Hello, \${name}\``
        const results = yield* parseTypeScriptCode(code)
        const names = findNames(results)

        assert.isTrue(names.includes('greet'))
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('ambient declarations', () => {
    it.scoped('captures declare function', () =>
      Effect.gen(function* () {
        const code = `declare function externalFunc(arg: string): void`
        const results = yield* parseTypeScriptCode(code)
        const names = findNames(results)
        const contexts = findContexts(results)

        assert.isTrue(names.includes('externalFunc'))
        assert.isTrue(contexts.includes('declare'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures declare class', () =>
      Effect.gen(function* () {
        const code = `declare class ExternalClass { constructor(value: string) }`
        const results = yield* parseTypeScriptCode(code)
        const names = findNames(results)
        const contexts = findContexts(results)

        assert.isTrue(names.includes('ExternalClass'))
        assert.isTrue(contexts.includes('declare'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures declare abstract class', () =>
      Effect.gen(function* () {
        const code = `declare abstract class AbstractExternal { abstract method(): void }`
        const results = yield* parseTypeScriptCode(code)
        const names = findNames(results)
        const contexts = findContexts(results)

        assert.isTrue(names.includes('AbstractExternal'))
        assert.isTrue(contexts.includes('declare'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures declare const', () =>
      Effect.gen(function* () {
        const code = `declare const GLOBAL_CONFIG: { apiUrl: string }`
        const results = yield* parseTypeScriptCode(code)
        const names = findNames(results)
        const contexts = findContexts(results)

        assert.isTrue(names.includes('GLOBAL_CONFIG'))
        assert.isTrue(contexts.includes('declare'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures declare let', () =>
      Effect.gen(function* () {
        const code = `declare let mutableGlobal: number`
        const results = yield* parseTypeScriptCode(code)
        const names = findNames(results)
        const contexts = findContexts(results)

        assert.isTrue(names.includes('mutableGlobal'))
        assert.isTrue(contexts.includes('declare'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures declare var', () =>
      Effect.gen(function* () {
        const code = `declare var globalVar: Window`
        const results = yield* parseTypeScriptCode(code)
        const names = findNames(results)
        const contexts = findContexts(results)

        assert.isTrue(names.includes('globalVar'))
        assert.isTrue(contexts.includes('declare'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures declare namespace', () =>
      Effect.gen(function* () {
        const code = `declare namespace NodeJS { interface ProcessEnv { NODE_ENV: string } }`
        const results = yield* parseTypeScriptCode(code)
        const names = findNames(results)
        const contexts = findContexts(results)

        assert.isTrue(names.includes('NodeJS'))
        assert.isTrue(contexts.includes('declare'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped(
      'does not capture declare module with string name (different AST structure)',
      () =>
        Effect.gen(function* () {
          const code = `declare module 'custom-module' { export const value: number }`
          const results = yield* parseTypeScriptCode(code)
          const items = findItems(results)

          assert.strictEqual(items.length, 0)
        }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures declare enum', () =>
      Effect.gen(function* () {
        const code = `declare enum ExternalEnum { A, B, C }`
        const results = yield* parseTypeScriptCode(code)
        const names = findNames(results)
        const contexts = findContexts(results)

        assert.isTrue(names.includes('ExternalEnum'))
        assert.isTrue(contexts.includes('declare'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures declare interface', () =>
      Effect.gen(function* () {
        const code = `declare interface ExternalInterface { property: string }`
        const results = yield* parseTypeScriptCode(code)
        const names = findNames(results)
        const contexts = findContexts(results)

        assert.isTrue(names.includes('ExternalInterface'))
        assert.isTrue(contexts.includes('declare'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures declare type', () =>
      Effect.gen(function* () {
        const code = `declare type ExternalType = string | number`
        const results = yield* parseTypeScriptCode(code)
        const names = findNames(results)
        const contexts = findContexts(results)

        assert.isTrue(names.includes('ExternalType'))
        assert.isTrue(contexts.includes('declare'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures declare global', () =>
      Effect.gen(function* () {
        const code = `declare global { interface Window { myApp: unknown } }`
        const results = yield* parseTypeScriptCode(code)
        const contexts = findContexts(results)

        assert.isTrue(contexts.includes('declare'))
        assert.isTrue(contexts.includes('global'))
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('top-level expressions', () => {
    it.scoped('captures expression statement (IIFE)', () =>
      Effect.gen(function* () {
        const code = `(function() { console.log('IIFE') })()`
        const results = yield* parseTypeScriptCode(code)
        const items = findItems(results)

        assert.strictEqual(items.length, 1)
        assert.isTrue(items[0]!.includes('function'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures expression statement (call expression)', () =>
      Effect.gen(function* () {
        const code = `console.log('Hello, World!')`
        const results = yield* parseTypeScriptCode(code)
        const items = findItems(results)

        assert.strictEqual(items.length, 1)
        assert.isTrue(items[0]!.includes("console.log('Hello, World!')"))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures expression statement (assignment)', () =>
      Effect.gen(function* () {
        const code = `globalThis.myProperty = 'value'`
        const results = yield* parseTypeScriptCode(code)
        const items = findItems(results)

        assert.strictEqual(items.length, 1)
        assert.isTrue(items[0]!.includes("globalThis.myProperty = 'value'"))
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('complex scenarios', () => {
    it.scoped('captures multiple declarations in single file', () =>
      Effect.gen(function* () {
        const code = `
import { Effect } from 'effect'

export interface Config { debug: boolean }

export class App {
  constructor(private config: Config) {}
}

export const createApp = (config: Config) => new App(config)

export function bootstrap() {
  return createApp({ debug: true })
}
`
        const results = yield* parseTypeScriptCode(code)
        const items = findItems(results)
        const names = findNames(results)

        assert.isTrue(items.length >= 5)
        assert.isTrue(names.includes('Config'))
        assert.isTrue(names.includes('App'))
        assert.isTrue(names.includes('createApp'))
        assert.isTrue(names.includes('bootstrap'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('handles empty file', () =>
      Effect.gen(function* () {
        const code = ``
        const results = yield* parseTypeScriptCode(code)

        assert.strictEqual(results.length, 0)
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('handles file with only comments', () =>
      Effect.gen(function* () {
        const code = `
// This is a comment
/* This is a block comment */
`
        const results = yield* parseTypeScriptCode(code)

        assert.strictEqual(results.length, 0)
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped('captures generic type declarations', () =>
      Effect.gen(function* () {
        const code = `
type Maybe<T> = T | null | undefined

interface Repository<T, ID> {
  findById(id: ID): Promise<T | null>
  save(entity: T): Promise<T>
}

class GenericClass<T extends object> {
  constructor(private data: T) {}
}
`
        const results = yield* parseTypeScriptCode(code)
        const names = findNames(results)

        assert.isTrue(names.includes('Maybe'))
        assert.isTrue(names.includes('Repository'))
        assert.isTrue(names.includes('GenericClass'))
      }).pipe(Effect.provide(TestLive)),
    )

    it.scoped(
      'captures each variable declarator separately in multi-declarator statement',
      () =>
        Effect.gen(function* () {
          const code = `const a = 1, b = 2, c = 3`
          const results = yield* parseTypeScriptCode(code)
          const items = findItems(results)
          const names = findNames(results)

          assert.strictEqual(items.length, 3)
          assert.isTrue(names.includes('a'))
          assert.isTrue(names.includes('b'))
          assert.isTrue(names.includes('c'))
        }).pipe(Effect.provide(TestLive)),
    )
  })
})
