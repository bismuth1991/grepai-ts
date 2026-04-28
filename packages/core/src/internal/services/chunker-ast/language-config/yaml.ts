import type { SyntaxNode } from '../ast-parser'

import { ChunkerLanguageConfig } from '.'

export const yaml: ChunkerLanguageConfig = {
  isClosingSyntax: (text: string) => /^[\s\]},-]+$/.test(text),

  extractNodeName,

  wantedNodes: new Set([
    'block_mapping_pair',
    'flow_pair',
    'block_sequence_item',
  ]),

  scopeNodes: new Set([
    'block_mapping_pair',
    'flow_pair',
    'block_sequence_item',
  ]),

  importNodes: new Set([]),
}

function extractNodeName(node: SyntaxNode): string {
  if (node.type === 'block_mapping_pair' || node.type === 'flow_pair') {
    const key = node.childForFieldName('key')
    if (key) {
      return stripQuotes(key.text)
    }
    return '<pair>'
  }

  if (node.type === 'block_sequence_item') {
    const value = node.namedChildren[0]
    if (value) {
      return value.type
    }
    return '<item>'
  }

  return '<anonymous>'
}

function stripQuotes(text: string): string {
  if (text.length >= 2) {
    const first = text[0]
    const last = text[text.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return text.slice(1, -1)
    }
  }
  return text
}
