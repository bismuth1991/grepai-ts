import type { SupportedLanguage } from '../../../domain'
import type { SyntaxNode } from './ast-parser'

import * as Array from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Hash from 'effect/Hash'
import * as Layer from 'effect/Layer'

import { Chunker } from '../../../domain/chunker'
import { Config } from '../../../domain/config'
import {
  ChunkerError,
  TokenCounterCacheError,
  TokenCounterError,
} from '../../../domain/errors'
import { TokenCounter } from '../../../domain/token-counter'

import { AstParser } from './ast-parser'
import { ContextHeaderBuilder } from './context-header-builder'
import { languageConfig } from './language-config'

type OutChunk = {
  startIndex: number
  endIndex: number
  startLine: number
  endLine: number
  tokenCount: number
  scope: ReadonlyArray<ReadonlyArray<string>>
}
type SplitChunk = OutChunk & {
  type: 'wanted' | 'gap'
}

type SplitFn = (
  node: SyntaxNode,
  language: SupportedLanguage,
  scopeStack: ReadonlyArray<string>,
) => Effect.Effect<
  SplitChunk[],
  TokenCounterError | TokenCounterCacheError,
  never
>

export const ChunkerAst = Layer.effect(
  Chunker,
  Effect.gen(function* () {
    const astParser = yield* AstParser
    const tokenCounter = yield* TokenCounter
    const contextHeaderBuilder = yield* ContextHeaderBuilder
    const config = yield* Config

    const split: SplitFn = Effect.fnUntraced(
      function* (node, language, scopeStack) {
        const {
          wantedNodes, //
          scopeNodes,
          importNodes,
          extractNodeName,
        } = languageConfig[language]

        const tokenCount = yield* tokenCounter.count(node.text)

        const isWanted = wantedNodes.has(node.type)
        const isScope = scopeNodes.has(node.type)
        const isImport = importNodes.has(node.type)

        const nextScope =
          isScope && !isImport
            ? [...scopeStack, extractNodeName(node)]
            : scopeStack

        if (isWanted) {
          if (
            tokenCount <= config.embedding.maxChunkSize ||
            node.childCount === 0
          ) {
            return [
              {
                type: 'wanted',
                startIndex: node.startIndex,
                endIndex: node.endIndex,
                startLine: node.startPosition.row,
                endLine: node.endPosition.row,
                tokenCount,
                scope: isImport ? [] : [nextScope],
              },
            ]
          }
        }

        if (node.childCount === 0) {
          return [
            {
              type: 'gap',
              startIndex: node.startIndex,
              endIndex: node.endIndex,
              startLine: node.startPosition.row,
              endLine: node.endPosition.row,
              tokenCount,
              scope: [],
            },
          ]
        }

        return yield* Effect.forEach(
          node.children,
          (child) => split(child, language, nextScope),
          {
            concurrency: 'unbounded',
          },
        ).pipe(Effect.map(Array.flatten))
      },
    )

    function reMerge(
      chunks: SplitChunk[],
      content: string,
      language: SupportedLanguage,
    ) {
      const sorted = [...chunks].sort(
        (a, b) => a.startIndex - b.startIndex || a.endIndex - b.endIndex,
      )
      const { isClosingSyntax } = languageConfig[language]

      const loop = (
        index: number = 0,
        output: OutChunk[] = [],
        current?: OutChunk,
        pendingGap?: OutChunk,
      ): OutChunk[] => {
        if (index === sorted.length) {
          if (!current) {
            return output
          }
          return Array.append(output, appendGap(current, pendingGap))
        }

        const chunk = sorted[index]!

        if (chunk.type === 'gap') {
          const gapContent = content.slice(chunk.startIndex, chunk.endIndex)

          if (isClosingSyntax(gapContent) && current) {
            const nextCurrent = mergeChunks(
              appendGap(current, pendingGap),
              chunk,
            )
            return loop(index + 1, output, nextCurrent)
          }
          return loop(index + 1, output, current, mergeGap(chunk, pendingGap))
        }

        const nextOutChunk = prependGap(chunk, pendingGap)

        if (!current) {
          return loop(index + 1, output, nextOutChunk)
        }

        const { current: nextCurrent, outputToAppend } =
          mergeWithinBudgetOrFlush(current, nextOutChunk, {
            targetChunkSize: config.embedding.targetChunkSize,
          })

        const nextOutput = !outputToAppend
          ? output
          : Array.append(output, outputToAppend)

        return loop(index + 1, nextOutput, nextCurrent)
      }

      return loop()
    }

    return Chunker.of({
      chunk: Effect.fnUntraced(
        function* ({ filePath, content, language }) {
          const tree = yield* astParser.parse({ content, language })

          return yield* split(tree.rootNode, language, []).pipe(
            Effect.map((splitChunks) =>
              reMerge(splitChunks, content, language),
            ),
            Effect.map(
              Array.map(
                ({ startLine, endLine, startIndex, endIndex, scope }) => {
                  const chunkContent = content.slice(startIndex, endIndex)
                  const contextHeader = contextHeaderBuilder.stringify({
                    filePath,
                    scope,
                  })
                  const contextualizedChunk = contextHeader + chunkContent

                  return {
                    hash: Hash.hash(contextualizedChunk).toString(),
                    filePath,
                    content: contextualizedChunk,
                    startLine,
                    endLine,
                    scope,
                  }
                },
              ),
            ),
          )
        },
        Effect.catchTags({
          AstParserError: (cause) => new ChunkerError({ cause }),
        }),
      ),
    })
  }),
).pipe(
  Layer.provide(AstParser.Default),
  Layer.provide(ContextHeaderBuilder.Default),
)

function mergeChunks(a: OutChunk, b: OutChunk): OutChunk {
  const mergedScope = dedupeScopes([...a.scope, ...b.scope])

  return {
    startIndex: Math.min(a.startIndex, b.startIndex),
    endIndex: Math.max(a.endIndex, b.endIndex),
    startLine: Math.min(a.startLine, b.startLine),
    endLine: Math.max(a.endLine, b.endLine),
    tokenCount: a.tokenCount + b.tokenCount,
    scope: mergedScope,
  }
}

function dedupeScopes(
  scopes: ReadonlyArray<ReadonlyArray<string>>,
): ReadonlyArray<ReadonlyArray<string>> {
  const seen = new Set<string>()
  const result: ReadonlyArray<string>[] = []
  for (const scope of scopes) {
    const key = scope.join('\0')
    if (!seen.has(key)) {
      seen.add(key)
      result.push(scope)
    }
  }
  return result
}

function toOutChunk(chunk: SplitChunk): OutChunk {
  return {
    startIndex: chunk.startIndex,
    endIndex: chunk.endIndex,
    startLine: chunk.startLine,
    endLine: chunk.endLine,
    tokenCount: chunk.tokenCount,
    scope: chunk.scope,
  }
}

function mergeGap(gap: SplitChunk, existingGap?: OutChunk): OutChunk {
  return existingGap
    ? mergeChunks(existingGap, toOutChunk(gap))
    : toOutChunk(gap)
}

function prependGap(wanted: SplitChunk, pendingGap?: OutChunk): OutChunk {
  return pendingGap
    ? mergeChunks(pendingGap, toOutChunk(wanted))
    : toOutChunk(wanted)
}

function appendGap(current: OutChunk, pendingGap?: OutChunk) {
  return pendingGap ? mergeChunks(current, pendingGap) : current
}

function mergeWithinBudgetOrFlush(
  current: OutChunk,
  next: OutChunk,
  config: {
    targetChunkSize: number
  },
): { current: OutChunk; outputToAppend?: OutChunk } {
  if (
    current.tokenCount > config.targetChunkSize ||
    next.tokenCount > config.targetChunkSize
  ) {
    return { current: next, outputToAppend: current }
  }

  if (current.tokenCount + next.tokenCount <= config.targetChunkSize) {
    return {
      current: mergeChunks(current, next),
    }
  }

  return { current: next, outputToAppend: current }
}
