import { describe, expect, it } from '@effect/vitest'
import * as Effect from 'effect/Effect'

import { Chunker } from '../domain/chunker'
import { extractContextHeader, makeChunkerAstTestLayer } from './test-harness'

const TestLive = makeChunkerAstTestLayer()
const TestLiveTinyChunks = makeChunkerAstTestLayer({
  targetChunkSize: 20,
  maxChunkSize: 40,
})

describe('ChunkerAst Java Support', () => {
  it.effect('chunks a class declaration', () =>
    Effect.gen(function* () {
      const chunker = yield* Chunker
      const result = yield* chunker.chunk({
        filePath: '/test/Greeter.java',
        content: `package com.example;

public class Greeter {
  private final String name;

  public Greeter(String name) {
    this.name = name;
  }

  public String greet() {
    return "Hello, " + name;
  }
}`,
        language: 'java',
      })

      expect(result.length).toBeGreaterThan(0)
      const combined = result.map((chunk) => chunk.content).join('\n')
      expect(combined).toContain('public class Greeter')
      expect(combined).toContain('public String greet()')
    }).pipe(Effect.provide(TestLive)),
  )

  it.effect('keeps package and import declarations in chunk context', () =>
    Effect.gen(function* () {
      const chunker = yield* Chunker
      const result = yield* chunker.chunk({
        filePath: '/test/Repository.java',
        content: `package com.example;

import java.util.List;
import java.util.Optional;

public interface Repository {
  Optional<String> findById(String id);
  List<String> findAll();
}`,
        language: 'java',
      })

      expect(result.length).toBeGreaterThan(0)
      const allChunksContainImports = result.every((chunk) =>
        chunk.content.includes('import java.util.List;'),
      )
      expect(allChunksContainImports).toBe(true)
    }).pipe(Effect.provide(TestLive)),
  )

  it.effect('adds class and method names to context headers', () =>
    Effect.gen(function* () {
      const chunker = yield* Chunker
      const result = yield* chunker.chunk({
        filePath: '/test/Service.java',
        content: `public class Service {
  public String first() {
    return "first";
  }

  public String second() {
    return "second";
  }
}`,
        language: 'java',
      })

      expect(result.length).toBeGreaterThan(0)
      const header = extractContextHeader(result[0]!.content)
      expect(header).toContain('# filePath: /test/Service.java')
      expect(header).toContain('Service')
    }).pipe(Effect.provide(TestLiveTinyChunks)),
  )
})
