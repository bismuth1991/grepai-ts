import { describe, it, expect } from '@effect/vitest'
import * as Effect from 'effect/Effect'

import { Chunker } from '../domain/chunker'
import { extractContextHeader, makeChunkerAstTestLayer } from './test-harness'

const TestLive = makeChunkerAstTestLayer()
const TestLiveLargeChunks = makeChunkerAstTestLayer({
  targetChunkSize: 500,
  maxChunkSize: 1000,
})
const TestLiveTinyChunks = makeChunkerAstTestLayer({
  targetChunkSize: 15,
  maxChunkSize: 30,
})

describe('ChunkerAst Prisma Support', () => {
  describe('basic Prisma parsing', () => {
    it.effect('chunks a model declaration', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/schema.prisma',
          content: `model User {
  id    Int    @id @default(autoincrement())
  email String @unique
  name  String?
}`,
          language: 'prisma',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasModel = result.some((chunk) =>
          chunk.content.includes('model User'),
        )
        expect(hasModel).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('chunks an enum declaration', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/schema.prisma',
          content: `enum Role {
  USER
  ADMIN
  MODERATOR
}`,
          language: 'prisma',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasEnum = result.some((chunk) =>
          chunk.content.includes('enum Role'),
        )
        expect(hasEnum).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('chunks a datasource declaration', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/schema.prisma',
          content: `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}`,
          language: 'prisma',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasDatasource = result.some((chunk) =>
          chunk.content.includes('datasource db'),
        )
        expect(hasDatasource).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('chunks a generator declaration', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/schema.prisma',
          content: `generator client {
  provider = "prisma-client-js"
}`,
          language: 'prisma',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasGenerator = result.some((chunk) =>
          chunk.content.includes('generator client'),
        )
        expect(hasGenerator).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('chunks a type (composite type) declaration', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/schema.prisma',
          content: `type Address {
  street String
  city   String
  zip    String
}`,
          language: 'prisma',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasType = result.some((chunk) =>
          chunk.content.includes('type Address'),
        )
        expect(hasType).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('context header', () => {
    it.effect('includes file path in context header', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/schema.prisma',
          content: `model User {
  id Int @id
}`,
          language: 'prisma',
        })

        expect(result.length).toBeGreaterThan(0)
        const header = extractContextHeader(result[0]!.content)
        expect(header).toContain('# filePath: /test/schema.prisma')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('injects scope header for model fields', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/schema.prisma',
          content: `model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  posts     Post[]
  profile   Profile?
}`,
          language: 'prisma',
        })

        expect(result.length).toBeGreaterThan(0)
        const chunkWithFields = result.find((chunk) =>
          chunk.content.includes('email'),
        )
        expect(chunkWithFields).toBeDefined()
        if (!chunkWithFields) return

        const header = extractContextHeader(chunkWithFields.content)
        expect(header).toContain('# filePath: /test/schema.prisma')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('generates deterministic ids', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const content = `model User {
  id Int @id
}`

        const result1 = yield* chunker.chunk({
          filePath: '/test/schema.prisma',
          content,
          language: 'prisma',
        })
        const result2 = yield* chunker.chunk({
          filePath: '/test/schema.prisma',
          content,
          language: 'prisma',
        })

        expect(result1[0]!.id).toBe(result2[0]!.id)
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('chunk merging behavior', () => {
    it.effect('merges small declarations within target size', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/schema.prisma',
          content: `enum Role {
  USER
  ADMIN
}

enum Status {
  ACTIVE
  INACTIVE
}`,
          language: 'prisma',
        })

        expect(result.length).toBeLessThanOrEqual(2)
      }).pipe(Effect.provide(TestLiveLargeChunks)),
    )

    it.effect('keeps large models separate', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const longField = 'x'.repeat(280)
        const result = yield* chunker.chunk({
          filePath: '/test/schema.prisma',
          content: `model First {
  id   Int    @id
  data String @default("${longField}")
}

model Second {
  id   Int    @id
  data String @default("${longField}")
}`,
          language: 'prisma',
        })

        expect(result.length).toBeGreaterThanOrEqual(2)
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('line tracking', () => {
    it.effect('tracks start and end lines correctly', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/schema.prisma',
          content: `model User {
  id    Int    @id
  email String @unique
}`,
          language: 'prisma',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.startLine).toBe(0)
        expect(result[0]!.endLine).toBeGreaterThanOrEqual(result[0]!.startLine)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('returns 0-based line numbers', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/schema.prisma',
          content: `model User {
  id Int @id
}`,
          language: 'prisma',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.startLine).toBe(0)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('returns chunks in non-decreasing line order', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/schema.prisma',
          content: `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id    Int    @id
  email String @unique
}

model Post {
  id       Int    @id
  title    String
  authorId Int
}

enum Role {
  USER
  ADMIN
}`,
          language: 'prisma',
        })

        for (let i = 1; i < result.length; i++) {
          expect(result[i]!.startLine).toBeGreaterThanOrEqual(
            result[i - 1]!.startLine,
          )
        }
      }).pipe(Effect.provide(TestLiveTinyChunks)),
    )
  })

  describe('edge cases', () => {
    it.effect('handles empty file', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/empty.prisma',
          content: '',
          language: 'prisma',
        })

        expect(result).toEqual([])
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles file with only comments', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/comments.prisma',
          content: `// This is a comment
/// This is a doc comment`,
          language: 'prisma',
        })

        expect(Array.isArray(result)).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles model with block attributes', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/schema.prisma',
          content: `model User {
  id        Int    @id
  firstName String
  lastName  String
  email     String

  @@unique([firstName, lastName])
  @@map("users")
  @@index([email])
}`,
          language: 'prisma',
        })

        expect(result.length).toBeGreaterThan(0)
        const combined = result.map((chunk) => chunk.content).join('\n')
        expect(combined).toContain('@@unique')
        expect(combined).toContain('@@map')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles model with relations', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/schema.prisma',
          content: `model User {
  id    Int    @id @default(autoincrement())
  posts Post[]
}

model Post {
  id       Int  @id @default(autoincrement())
  author   User @relation(fields: [authorId], references: [id])
  authorId Int
}`,
          language: 'prisma',
        })

        expect(result.length).toBeGreaterThan(0)
        const combined = result.map((chunk) => chunk.content).join('\n')
        expect(combined).toContain('model User')
        expect(combined).toContain('model Post')
        expect(combined).toContain('@relation')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles nullable and array field types', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/schema.prisma',
          content: `model User {
  id       Int      @id
  name     String?
  tags     String[]
  roles    Role[]
}`,
          language: 'prisma',
        })

        expect(result.length).toBeGreaterThan(0)
        const combined = result.map((chunk) => chunk.content).join('\n')
        expect(combined).toContain('String?')
        expect(combined).toContain('String[]')
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('closing syntax handling', () => {
    it.effect('does not emit chunks that only contain closing syntax', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/schema.prisma',
          content: `model User {
  id    Int    @id
  email String @unique
  name  String?
}`,
          language: 'prisma',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasClosingOnlyChunk = result.some((chunk) => {
          const body = chunk.content.split('---\n')[1] ?? ''
          return /^[\s}]+$/.test(body)
        })
        expect(hasClosingOnlyChunk).toBe(false)
      }).pipe(Effect.provide(TestLiveTinyChunks)),
    )
  })

  describe('realistic Prisma schema', () => {
    it.effect('handles a complete Prisma schema', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/schema.prisma',
          content: `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  role      Role     @default(USER)
  posts     Post[]
  profile   Profile?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  Int
  tags      Tag[]
  createdAt DateTime @default(now())

  @@index([authorId])
}

model Profile {
  id     Int    @id @default(autoincrement())
  bio    String?
  user   User   @relation(fields: [userId], references: [id])
  userId Int    @unique
}

model Tag {
  id    Int    @id @default(autoincrement())
  name  String @unique
  posts Post[]
}

enum Role {
  USER
  ADMIN
  MODERATOR
}`,
          language: 'prisma',
        })

        expect(result.length).toBeGreaterThan(0)
        const combined = result.map((chunk) => chunk.content).join('\n')
        expect(combined).toContain('datasource db')
        expect(combined).toContain('generator client')
        expect(combined).toContain('model User')
        expect(combined).toContain('model Post')
        expect(combined).toContain('model Profile')
        expect(combined).toContain('model Tag')
        expect(combined).toContain('enum Role')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles schema with multiple enums', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/schema.prisma',
          content: `enum Role {
  USER
  ADMIN
}

enum Status {
  ACTIVE
  INACTIVE
  PENDING
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}`,
          language: 'prisma',
        })

        expect(result.length).toBeGreaterThan(0)
        const combined = result.map((chunk) => chunk.content).join('\n')
        expect(combined).toContain('enum Role')
        expect(combined).toContain('enum Status')
        expect(combined).toContain('enum Priority')
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('import handling', () => {
    it.effect('has no import nodes (Prisma has no imports)', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/schema.prisma',
          content: `model User {
  id Int @id
}`,
          language: 'prisma',
        })

        expect(result.length).toBeGreaterThan(0)
        // All chunks should have scope since Prisma has no imports
        for (const chunk of result) {
          const header = extractContextHeader(chunk.content)
          expect(header).toContain('# filePath: /test/schema.prisma')
        }
      }).pipe(Effect.provide(TestLive)),
    )
  })
})
