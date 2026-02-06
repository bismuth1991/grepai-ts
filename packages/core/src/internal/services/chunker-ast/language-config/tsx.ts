import type { SyntaxNode } from '../ast-parser'

import { ChunkerLanguageConfig } from '.'

export const tsx: ChunkerLanguageConfig = {
  // Regex patterns:
  // 1. /^[\s)}\]>]+$/ - Standard TS closing: ), ], }, >
  // 2. /^\s*\/>/ - JSX self-closing: />
  // 3. /^\s*<\/[a-zA-Z_$][\w$.:-]*\s*>/ - JSX closing tag: </Name>
  isClosingSyntax: (text: string) =>
    /^[\s)}\]>]+$/.test(text) ||
    /^\s*\/>/.test(text) ||
    /^\s*<\/[a-zA-Z_$][\w$.:-]*\s*>/.test(text),

  extractNodeName,

  wantedNodes: new Set([
    'function_declaration',
    'function_expression',
    'generator_function_declaration',
    'generator_function',
    'arrow_function',
    'function_signature',
    'method_definition',
    'method_signature',
    'abstract_method_signature',
    'class_declaration',
    'class',
    'abstract_class_declaration',
    'public_field_definition',
    'field_definition',
    'class_static_block',
    'interface_declaration',
    'type_alias_declaration',
    'enum_declaration',
    'lexical_declaration',
    'variable_declaration',
    'using_declaration',
    'module',
    'internal_module',
    'ambient_declaration',
    'import_alias',
    'export_statement',
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
    // JSX scope nodes - provide context like "inside UserCard > Header > Avatar"
    'jsx_element',
    'jsx_self_closing_element',
  ]),

  importNodes: new Set([
    'import_statement',
    'export_statement',
    'import_alias',
  ]),
}

function extractNodeName(node: SyntaxNode): string {
  if (node.type === 'jsx_element') {
    const openTag = node.childForFieldName('open_tag')
    if (openTag) {
      const nameNode = openTag.childForFieldName('name')
      if (nameNode) {
        return nameNode.text
      }
    }
    return '<jsx>'
  }

  if (node.type === 'jsx_self_closing_element') {
    const nameNode = node.childForFieldName('name')
    if (nameNode) {
      return nameNode.text
    }
    return '<jsx>'
  }

  const nameChild = node.childForFieldName('name')
  if (nameChild) {
    return nameChild.text
  }

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

  const identifierChild = node.namedChildren.find(
    (child) =>
      child.type === 'identifier' ||
      child.type === 'property_identifier' ||
      child.type === 'type_identifier',
  )
  if (identifierChild) {
    return identifierChild.text
  }

  if (
    node.type === 'arrow_function' ||
    node.type === 'function_expression' ||
    node.type === 'generator_function'
  ) {
    let ancestor = node.parent
    while (ancestor) {
      if (ancestor.type === 'variable_declarator') {
        const varName = ancestor.childForFieldName('name')
        if (varName) {
          return varName.text
        }
      }
      if (ancestor.type === 'pair') {
        const key = ancestor.childForFieldName('key')
        if (key) {
          return key.text
        }
      }
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
