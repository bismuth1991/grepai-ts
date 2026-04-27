import type { SyntaxNode } from '../ast-parser'

import { ChunkerLanguageConfig } from '.'

export const java: ChunkerLanguageConfig = {
  isClosingSyntax: (text: string) => /^[\s)\]}>;]+$/.test(text),

  extractNodeName,

  wantedNodes: new Set([
    /** package com.example; */
    'package_declaration',
    /** import java.util.List; */
    'import_declaration',

    /** class Foo {} */
    'class_declaration',
    /** interface Foo {} */
    'interface_declaration',
    /** enum Foo {} */
    'enum_declaration',
    /** @interface Foo {} */
    'annotation_type_declaration',
    /** record Foo(String value) {} */
    'record_declaration',

    /** void method() {} */
    'method_declaration',
    /** Foo() {} */
    'constructor_declaration',
    /** int value; */
    'field_declaration',
  ]),

  scopeNodes: new Set([
    'class_declaration',
    'interface_declaration',
    'enum_declaration',
    'annotation_type_declaration',
    'record_declaration',
    'method_declaration',
    'constructor_declaration',
    'field_declaration',
  ]),

  importNodes: new Set(['package_declaration', 'import_declaration']),
}

function extractNodeName(node: SyntaxNode): string {
  const nameChild = node.childForFieldName('name')
  if (nameChild) {
    return nameChild.text
  }

  const identifierChild = node.namedChildren.find(
    (child) => child.type === 'identifier' || child.type === 'type_identifier',
  )
  if (identifierChild) {
    return identifierChild.text
  }

  return '<anonymous>'
}
