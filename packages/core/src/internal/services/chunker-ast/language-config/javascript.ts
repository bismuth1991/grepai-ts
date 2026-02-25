import type { SyntaxNode } from '../ast-parser'

import { ChunkerLanguageConfig } from '.'

export const javascript: ChunkerLanguageConfig = {
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

    /** Methods */
    /** class C { method() {} } */
    'method_definition',

    /** Classes */
    /** class Foo {} */
    'class_declaration',
    /** Anonymous class: new class {} */
    'class',
    /** class C { x = 1 } */
    'field_definition',
    /** class C { static { ... } } */
    'class_static_block',

    /** Variables */
    /** const x = 1, y = 2 */
    'lexical_declaration',
    /** var x = 1 */
    'variable_declaration',

    /** Imports/Exports */
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
    'lexical_declaration',
    'variable_declaration',
  ]),

  importNodes: new Set([
    'import_statement',
    'export_statement',
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
      child.type === 'property_identifier',
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
