; Captures:
; - @item: full node to chunk (WHOLE top-level declaration/statement)
; - @name: primary name (when applicable)
; - @context: lightweight signature context tokens

; =========================
; Imports (top-level)
; =========================
(program (import_statement) @item)

; Import alias: import x = require("mod") / import x = Namespace.Sub
(program
  (import_alias
    (identifier) @name) @item)

; =========================
; Exports / re-exports (top-level)
; =========================

; export { a, b } ... / export { a as b } ...
(program
  (export_statement
    "export" @context
    (export_clause)) @item)

; export * from "x"
(program
  (export_statement
    "export" @context
    "*" @context) @item)

; export default <expression> (no declaration)
(program
  (export_statement
    "export" @context
    "default" @context
    !declaration) @item)

; export default function (with optional name)
(program
  (export_statement
    "export" @context
    "default" @context
    declaration: (function_declaration
      name: (_)? @name)) @item)

; export default class (with optional name)
(program
  (export_statement
    "export" @context
    "default" @context
    declaration: (class_declaration
      (decorator)? @context
      name: (_)? @name)) @item)

; =========================
; Exported declarations (top-level)
; =========================

; export function
(program
  (export_statement
    "export" @context
    declaration: (function_declaration
      name: (_) @name)) @item)

; export class
(program
  (export_statement
    "export" @context
    declaration: (class_declaration
      (decorator)? @context
      name: (_) @name)) @item)

; export abstract class
(program
  (export_statement
    "export" @context
    declaration: (abstract_class_declaration
      (decorator)? @context
      name: (_) @name)) @item)

; export interface
(program
  (export_statement
    "export" @context
    declaration: (interface_declaration
      name: (_) @name)) @item)

; export type
(program
  (export_statement
    "export" @context
    declaration: (type_alias_declaration
      name: (_) @name)) @item)

; export enum
(program
  (export_statement
    "export" @context
    declaration: (enum_declaration
      name: (_) @name)) @item)

; export const/let
(program
  (export_statement
    "export" @context
    declaration: (lexical_declaration
      ["let" "const"] @context
      (variable_declarator
        name: (_) @name))) @item)

; export var
(program
  (export_statement
    "export" @context
    declaration: (variable_declaration
      "var" @context
      (variable_declarator
        name: (_) @name))) @item)

; TS: export = expr (parsed as export_statement with expression)
(program
  (export_statement
    "export" @context
    "=" @context
    !declaration) @item)

; =========================
; Namespaces / internal modules (top-level)
; =========================
(program
  (internal_module
    ["namespace" "module"] @context
    name: (_) @name) @item)

; =========================
; Enums / interfaces / type aliases (top-level)
; =========================
(program
  (enum_declaration
    "enum" @context
    name: (_) @name) @item)

(program
  (interface_declaration
    "interface" @context
    name: (_) @name) @item)

(program
  (type_alias_declaration
    "type" @context
    name: (_) @name) @item)

; =========================
; Classes (top-level)
; =========================
(program
  (class_declaration
    (decorator)? @context
    "class" @context
    name: (_) @name) @item)

(program
  (abstract_class_declaration
    (decorator)? @context
    "abstract" @context
    "class" @context
    name: (_) @name) @item)

; =========================
; Functions (top-level)
; =========================

; Regular function
(program
  (function_declaration
    "function" @context
    name: (_) @name
    parameters: (formal_parameters
      "(" @context
      ")" @context)) @item)

; Async function
(program
  (function_declaration
    "async" @context
    "function" @context
    name: (_) @name
    parameters: (formal_parameters
      "(" @context
      ")" @context)) @item)

; Generator function
(program
  (generator_function_declaration
    "function" @context
    "*" @context
    name: (_) @name
    parameters: (formal_parameters
      "(" @context
      ")" @context)) @item)

; Async generator function
(program
  (generator_function_declaration
    "async" @context
    "function" @context
    "*" @context
    name: (_) @name
    parameters: (formal_parameters
      "(" @context
      ")" @context)) @item)

; Overload-style signatures (esp. .d.ts)
(program
  (function_signature
    name: (_) @name
    parameters: (formal_parameters
      "(" @context
      ")" @context)) @item)

; =========================
; Variables (top-level) — whole declaration chunk
; Includes destructuring names via name: (_)
; =========================

; const / let
(program
  (lexical_declaration
    ["let" "const"] @context
    (variable_declarator
      name: (_) @name)) @item)

; var
(program
  (variable_declaration
    "var" @context
    (variable_declarator
      name: (_) @name)) @item)

; =========================
; Ambient / declare (top-level)
; =========================

; declare function
(program
  (ambient_declaration
    "declare" @context
    (function_signature
      name: (_) @name)) @item)

; declare class
(program
  (ambient_declaration
    "declare" @context
    (class_declaration
      (decorator)? @context
      name: (_) @name)) @item)

; declare abstract class
(program
  (ambient_declaration
    "declare" @context
    (abstract_class_declaration
      (decorator)? @context
      name: (_) @name)) @item)

; declare const/let
(program
  (ambient_declaration
    "declare" @context
    (lexical_declaration
      (variable_declarator
        name: (_) @name))) @item)

; declare var
(program
  (ambient_declaration
    "declare" @context
    (variable_declaration
      (variable_declarator
        name: (_) @name))) @item)

; declare namespace/module
(program
  (ambient_declaration
    "declare" @context
    (internal_module
      name: (_) @name)) @item)

; declare enum
(program
  (ambient_declaration
    "declare" @context
    (enum_declaration
      name: (_) @name)) @item)

; declare interface
(program
  (ambient_declaration
    "declare" @context
    (interface_declaration
      name: (_) @name)) @item)

; declare type
(program
  (ambient_declaration
    "declare" @context
    (type_alias_declaration
      name: (_) @name)) @item)

; declare global { ... }
(program
  (ambient_declaration
    "declare" @context
    "global" @context) @item)

; =========================
; Top-level expressions
; =========================

; Top-level expression statements
(program (expression_statement) @item)
