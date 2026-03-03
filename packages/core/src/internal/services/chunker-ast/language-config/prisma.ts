import type { SyntaxNode } from '../ast-parser'

import { ChunkerLanguageConfig } from '.'

export const prisma: ChunkerLanguageConfig = {
  isClosingSyntax: (text: string) => /^[\s}]+$/.test(text),

  extractNodeName,

  wantedNodes: new Set([
    /** Top-level declarations */
    /** model User { ... } */
    'model_declaration',
    /** enum Role { ... } */
    'enum_declaration',
    /** type Address { ... } or type Alias = ... */
    'type_declaration',
    /** datasource db { ... } */
    'datasource_declaration',
    /** generator client { ... } */
    'generator_declaration',
    /** view UserView { ... } */
    'view_declaration',

    /** Block contents */
    /** id Int @id @default(autoincrement()) */
    'column_declaration',
    /** USER, ADMIN (enum values) */
    'enumeral',
    /** provider = "postgresql" */
    'assignment_expression',
    /** @@map("users"), @@index([email]) */
    'block_attribute_declaration',
  ]),

  scopeNodes: new Set([
    'model_declaration',
    'enum_declaration',
    'type_declaration',
    'datasource_declaration',
    'generator_declaration',
    'view_declaration',
  ]),

  /** Prisma has no import statements */
  importNodes: new Set([]),
}

function extractNodeName(node: SyntaxNode): string {
  // model_declaration, enum_declaration, type_declaration,
  // datasource_declaration, generator_declaration, view_declaration
  // all have an identifier child as the name
  const nameChild = node.childForFieldName('name')
  if (nameChild) {
    return nameChild.text
  }

  // For declarations with a direct identifier child
  const identifierChild = node.namedChildren.find(
    (child) => child.type === 'identifier',
  )
  if (identifierChild) {
    return identifierChild.text
  }

  // column_declaration: first identifier is the field name
  if (node.type === 'column_declaration') {
    const firstIdent = node.namedChildren.find(
      (child) => child.type === 'identifier',
    )
    if (firstIdent) {
      return firstIdent.text
    }
  }

  // enumeral: identifier child is the enum value name
  if (node.type === 'enumeral') {
    const ident = node.namedChildren.find(
      (child) => child.type === 'identifier',
    )
    if (ident) {
      return ident.text
    }
  }

  // assignment_expression: variable child is the key name
  if (node.type === 'assignment_expression') {
    const variable = node.namedChildren.find(
      (child) => child.type === 'variable',
    )
    if (variable) {
      return variable.text
    }
  }

  // block_attribute_declaration: @@map, @@index, etc.
  if (node.type === 'block_attribute_declaration') {
    const callExpr = node.namedChildren.find(
      (child) => child.type === 'call_expression',
    )
    if (callExpr) {
      const ident = callExpr.namedChildren.find(
        (child) => child.type === 'identifier',
      )
      if (ident) {
        return `@@${ident.text}`
      }
    }
  }

  return '<anonymous>'
}
