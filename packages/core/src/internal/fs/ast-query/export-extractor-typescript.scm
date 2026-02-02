; Captures for extracting export names from TypeScript files.

; Named exports without alias: export { foo, bar }
(export_statement
  (export_clause
    (export_specifier
      name: (_) @export.name
      !alias)))

; Named exports with alias: export { foo as bar }
(export_statement
  (export_clause
    (export_specifier
      alias: (_) @export.alias)))

; Default export marker (captures when default is present)
(export_statement
  "default" @export.default)

; Exported function: export function foo() {}
(export_statement
  declaration: (function_declaration
    name: (_) @export.name))

; Exported class: export class Foo {}
(export_statement
  declaration: (class_declaration
    name: (_) @export.name))

; Exported abstract class: export abstract class Foo {}
(export_statement
  declaration: (abstract_class_declaration
    name: (_) @export.name))

; Exported interface: export interface Foo {}
(export_statement
  declaration: (interface_declaration
    name: (_) @export.name))

; Exported type alias: export type Foo = ...
(export_statement
  declaration: (type_alias_declaration
    name: (_) @export.name))

; Exported enum: export enum Foo {}
(export_statement
  declaration: (enum_declaration
    name: (_) @export.name))

; Exported const/let variable: export const foo = ...
(export_statement
  declaration: (lexical_declaration
    (variable_declarator
      name: (identifier) @export.name)))

; Exported var variable: export var foo = ...
(export_statement
  declaration: (variable_declaration
    (variable_declarator
      name: (identifier) @export.name)))

; Exported destructured const/let: export const { a, b } = obj
(export_statement
  declaration: (lexical_declaration
    (variable_declarator
      name: (object_pattern
        (shorthand_property_identifier_pattern) @export.name))))

; Exported destructured array: export const [a, b] = arr
(export_statement
  declaration: (lexical_declaration
    (variable_declarator
      name: (array_pattern
        (identifier) @export.name))))
