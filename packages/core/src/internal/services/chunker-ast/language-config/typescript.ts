import type { SyntaxNode } from '../ast-parser'

import { ChunkerLanguageConfig } from '.'

export const typescript: ChunkerLanguageConfig = {
  isClosingSyntax: (text: string) => /^[\s)\]}>]+$/.test(text),

  extractNodeName,

  wantedNodes: new Set([
    /** Functions */
    /** function foo() {} */
    'function_declaration',
    /** const f = function() {} */
    'function_expression',
    /** function* gen() {} */
    'generator_function_declaration',
    /** const g = function*() {} */
    'generator_function',
    /** const a = () => {} */
    'arrow_function',
    /** type S = (x: string) => void */
    'function_signature',

    /** Methods */
    /** class C { method() {} } */
    'method_definition',
    /** interface I { method(): void } */
    'method_signature',
    /** abstract class C { abstract m(): void } */
    'abstract_method_signature',

    /** Classes */
    /** class Foo {} */
    'class_declaration',
    /** Anonymous class: new class {} */
    'class',
    /** abstract class Foo {} */
    'abstract_class_declaration',
    /** class C { public x: number } */
    'public_field_definition',
    /** class C { x: number } */
    'field_definition',
    /** class C { static { ... } } */
    'class_static_block',

    /** Types */
    /** interface Foo {} */
    'interface_declaration',
    /** type Foo = string */
    'type_alias_declaration',
    /** enum E { A, B } */
    'enum_declaration',

    /** Variables */
    /** const x = 1, y = 2 */
    'lexical_declaration',
    /** var x: number */
    'variable_declaration',
    /** using resource = ... */
    'using_declaration',

    /** Modules */
    /** module M { ... } */
    'module',
    /** namespace N { ... } */
    'internal_module',
    /** declare global { ... } */
    'ambient_declaration',

    /** Imports/Exports */
    /** import type { X as Y } */
    'import_alias',
    /** export { x } from './mod' */
    'export_statement',
    /** import { x } from './mod' */
    'import_statement',
  ]),

  scopeNodes: new Set([
    'function_declaration',
    'generator_function_declaration',
    'method_definition',
    'class_declaration',
    'class',
    'abstract_class_declaration',
    'interface_declaration',
    'enum_declaration',
    'module',
    'internal_module',
    'lexical_declaration',
    'variable_declaration',
  ]),

  importNodes: new Set([
    'import_statement',
    'export_statement',
    'import_alias',
  ]),
}

function extractNodeName(node: SyntaxNode): string {
  // Try direct name via field (function_declaration, class_declaration, etc.)
  const nameChild = node.childForFieldName('name')
  if (nameChild) {
    return nameChild.text
  }

  // Handle lexical_declaration / variable_declaration: const foo = ...
  // Structure: lexical_declaration -> variable_declarator (name field)
  if (
    node.type === 'lexical_declaration' ||
    node.type === 'variable_declaration'
  ) {
    const declarator = node.namedChildren.find(
      (child) => child.type === 'variable_declarator',
    )
    if (declarator) {
      const varName = declarator.childForFieldName('name')
      if (varName) {
        return varName.text
      }
    }
  }

  // For nodes with identifier children (method_definition, etc.)
  const identifierChild = node.namedChildren.find(
    (child) =>
      child.type === 'identifier' ||
      child.type === 'property_identifier' ||
      child.type === 'type_identifier',
  )
  if (identifierChild) {
    return identifierChild.text
  }

  // Infer name for anonymous functions assigned to variables
  // Handles: const foo = () => {}, const foo = someWrapper(function() {})
  if (
    node.type === 'arrow_function' ||
    node.type === 'function_expression' ||
    node.type === 'generator_function'
  ) {
    // Traverse UP the tree to find a variable_declarator ancestor
    let ancestor = node.parent
    while (ancestor) {
      if (ancestor.type === 'variable_declarator') {
        const varName = ancestor.childForFieldName('name')
        if (varName) {
          return varName.text
        }
      }
      // Also handle object properties: { key: () => {} }
      if (ancestor.type === 'pair') {
        const key = ancestor.childForFieldName('key')
        if (key) {
          return key.text
        }
      }
      // Stop at statement boundaries to avoid false positives
      if (
        ancestor.type === 'lexical_declaration' ||
        ancestor.type === 'variable_declaration' ||
        ancestor.type === 'expression_statement'
      ) {
        break
      }
      ancestor = ancestor.parent
    }
  }

  return '<anonymous>'
}
