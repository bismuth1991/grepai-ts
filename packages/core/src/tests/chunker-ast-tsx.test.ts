import { describe, it, expect } from '@effect/vitest'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

import { Chunker } from '../domain/chunker'
import { Config } from '../domain/config'
import { TokenCounter } from '../domain/token-counter'
import { ChunkerAst } from '../internal/services/chunker-ast'
import { AstParser } from '../internal/services/chunker-ast/ast-parser'
import { ContextHeaderBuilder } from '../internal/services/chunker-ast/context-header-builder'

const TokenCounterTest = Layer.succeed(TokenCounter, {
  count: (content: string) => Effect.succeed(Math.ceil(content.length / 4)),
})

const SmallChunkConfig = Layer.succeed(Config, {
  cwd: '/test',
  embedding: {
    provider: 'google',
    model: 'gemini-embedding-001',
    apiKey: 'test-key',
    targetChunkSize: 50,
    maxChunkSize: 100,
    dimensions: 3072,
    embeddingBatchSize: 100,
    tokenizer: 'simple',
  },
  include: [],
  exclude: [],
  storage: {
    type: 'turso',
    url: 'test',
    authToken: 'test',
  },
})

const LargeChunkConfig = Layer.succeed(Config, {
  cwd: '/test',
  embedding: {
    provider: 'google',
    model: 'gemini-embedding-001',
    apiKey: 'test-key',
    targetChunkSize: 500,
    maxChunkSize: 1000,
    dimensions: 3072,
    embeddingBatchSize: 100,
    tokenizer: 'simple',
  },
  include: [],
  exclude: [],
  storage: {
    type: 'turso',
    url: 'test',
    authToken: 'test',
  },
})

const TestLive = ChunkerAst.pipe(
  Layer.provide(AstParser.Default),
  Layer.provide(ContextHeaderBuilder.Default),
  Layer.provide(TokenCounterTest),
  Layer.provide(SmallChunkConfig),
)

const TestLiveLargeChunks = ChunkerAst.pipe(
  Layer.provide(AstParser.Default),
  Layer.provide(ContextHeaderBuilder.Default),
  Layer.provide(TokenCounterTest),
  Layer.provide(LargeChunkConfig),
)

const TinyChunkConfig = Layer.succeed(Config, {
  cwd: '/test',
  embedding: {
    provider: 'google',
    model: 'gemini-embedding-001',
    apiKey: 'test-key',
    targetChunkSize: 15,
    maxChunkSize: 30,
    dimensions: 3072,
    embeddingBatchSize: 100,
    tokenizer: 'simple',
  },
  include: [],
  exclude: [],
  storage: {
    type: 'turso',
    url: 'test',
    authToken: 'test',
  },
})

const TestLiveTinyChunks = ChunkerAst.pipe(
  Layer.provide(AstParser.Default),
  Layer.provide(ContextHeaderBuilder.Default),
  Layer.provide(TokenCounterTest),
  Layer.provide(TinyChunkConfig),
)

function extractContextHeader(content: string) {
  const [header = ''] = content.split('\n---\n')
  return header
}

describe('ChunkerAst TSX Support', () => {
  describe('basic JSX parsing', () => {
    it.effect('parses simple JSX element', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function Hello() {
  return <div>Hello World</div>
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.content).toContain('<div>')
        expect(result[0]!.content).toContain('</div>')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('parses self-closing JSX element', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function Avatar() {
  return <img src="avatar.png" />
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.content).toContain('/>')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('parses JSX with expressions', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function Greeting({ name }: { name: string }) {
  return <span>Hello, {name}!</span>
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.content).toContain('{name}')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('parses JSX with multiple attributes', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function Button() {
  return <button className="btn" onClick={() => {}} disabled={false}>Click</button>
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.content).toContain('className')
        expect(result[0]!.content).toContain('onClick')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('parses JSX fragments', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function List() {
  return (
    <>
      <li>One</li>
      <li>Two</li>
    </>
  )
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.content).toContain('<>')
        expect(result[0]!.content).toContain('</>')
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('component patterns', () => {
    it.effect('handles function component declaration', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function MyComponent() {
  return <div>Content</div>
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasComponent = result.some((chunk) =>
          chunk.content.includes('function MyComponent()'),
        )
        expect(hasComponent).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles arrow function component', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `const Button = () => {
  return <button>Click me</button>
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasButton = result.some((chunk) =>
          chunk.content.includes('const Button = () =>'),
        )
        expect(hasButton).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles arrow function with implicit return', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `const Card = () => <div className="card">Card content</div>`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasCard = result.some((chunk) =>
          chunk.content.includes('const Card = () =>'),
        )
        expect(hasCard).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles React.FC typed component', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `const Header: React.FC<{ title: string }> = ({ title }) => {
  return <header><h1>{title}</h1></header>
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasHeader = result.some((chunk) =>
          chunk.content.includes('const Header: React.FC'),
        )
        expect(hasHeader).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles forwardRef component', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `const Input = React.forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  return <input ref={ref} {...props} />
})`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasInput = result.some((chunk) =>
          chunk.content.includes('const Input = React.forwardRef'),
        )
        expect(hasInput).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles memo wrapped component', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `const ExpensiveList = React.memo(function ExpensiveList({ items }: Props) {
  return <ul>{items.map(i => <li key={i}>{i}</li>)}</ul>
})`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.content).toContain('ExpensiveList')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles class component', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `class Counter extends React.Component<Props, State> {
  render() {
    return <div>{this.state.count}</div>
  }
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasCounter = result.some((chunk) =>
          chunk.content.includes('class Counter extends React.Component'),
        )
        expect(hasCounter).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('nested JSX structure', () => {
    it.effect('handles deeply nested elements', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function Layout() {
  return (
    <div className="layout">
      <header>
        <nav>
          <ul>
            <li><a href="/">Home</a></li>
          </ul>
        </nav>
      </header>
    </div>
  )
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.content).toContain('<header>')
        expect(result[0]!.content).toContain('</header>')
        expect(result[0]!.content).toContain('<nav>')
        expect(result[0]!.content).toContain('</nav>')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles sibling elements', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function Page() {
  return (
    <main>
      <Header />
      <Content />
      <Footer />
    </main>
  )
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.content).toContain('<Header />')
        expect(result[0]!.content).toContain('<Content />')
        expect(result[0]!.content).toContain('<Footer />')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles mixed elements and expressions', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function ItemList({ items }: { items: string[] }) {
  return (
    <ul>
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  )
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.content).toContain('items.map')
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('JSX closing syntax handling', () => {
    it.effect('keeps closing tags with their opening tags', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function Container() {
  return (
    <section>
      <article>Content</article>
    </section>
  )
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        const sectionChunk = result.find((c) => c.content.includes('<section>'))
        expect(sectionChunk).toBeDefined()
        expect(sectionChunk!.content).toContain('</section>')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles self-closing elements correctly', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function Form() {
  return (
    <form>
      <input type="text" />
      <input type="email" />
      <button type="submit" />
    </form>
  )
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        const formChunk = result.find((c) => c.content.includes('<form>'))
        expect(formChunk).toBeDefined()
        expect(formChunk!.content).toContain('</form>')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles PascalCase component closing tags', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function App() {
  return (
    <Layout>
      <Sidebar>
        <MenuItem />
      </Sidebar>
    </Layout>
  )
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        const chunk = result.find((c) => c.content.includes('<Layout>'))
        expect(chunk).toBeDefined()
        expect(chunk!.content).toContain('</Layout>')
        expect(chunk!.content).toContain('</Sidebar>')
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('component tracking with JSX', () => {
    it.effect('function component is preserved in output', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function UserProfile() {
  return <div>Profile</div>
}`,
          language: 'tsx',
        })

        expect(result.length).toBe(1)
        expect(result[0]!.content).toContain('function UserProfile()')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('arrow function component is preserved in output', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `const Dashboard = () => {
  return <main>Dashboard</main>
}`,
          language: 'tsx',
        })

        expect(result.length).toBe(1)
        expect(result[0]!.content).toContain('const Dashboard = () =>')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('class component method is preserved in output', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `class App extends React.Component {
  render() {
    return <div>App</div>
  }
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasAppClass = result.some((chunk) =>
          chunk.content.includes('class App extends React.Component'),
        )
        expect(hasAppClass).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('context header with JSX', () => {
    it.effect('includes file path for TSX files', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/src/components/Button.tsx',
          content: `const Button = () => <button>Click</button>`,
          language: 'tsx',
        })

        expect(result.length).toBe(1)
        expect(result[0]!.content).toContain('/src/components/Button.tsx')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('injects component scope lines into header', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function NavigationMenu() {
  return <nav>Menu</nav>
}`,
          language: 'tsx',
        })

        expect(result.length).toBe(1)
        const header = extractContextHeader(result[0]!.content)
        expect(header).toContain('# filePath: /test/component.tsx')
        expect(header).toContain('# scope:')
        expect(header).toContain('#   - NavigationMenu')
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('TypeScript features in TSX', () => {
    it.effect('handles generic components', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function List<T>({ items, renderItem }: ListProps<T>) {
  return <ul>{items.map(renderItem)}</ul>
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.content).toContain('List<T>')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles interface with component', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `interface ButtonProps {
  label: string
  onClick: () => void
}

const Button = ({ label, onClick }: ButtonProps) => {
  return <button onClick={onClick}>{label}</button>
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasInterface = result.some((c) => c.content.includes('interface'))
        const hasComponent = result.some((c) => c.content.includes('<button'))
        expect(hasInterface || hasComponent).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles type with component', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `type CardProps = {
  title: string
  children: React.ReactNode
}

const Card = ({ title, children }: CardProps) => (
  <div className="card">
    <h2>{title}</h2>
    {children}
  </div>
)`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles as const assertion in JSX context', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `const SIZES = ['sm', 'md', 'lg'] as const

type Size = typeof SIZES[number]

const Button = ({ size }: { size: Size }) => (
  <button className={size}>Click</button>
)`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles enum with component', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `enum Status {
  Active = 'active',
  Inactive = 'inactive'
}

const StatusBadge = ({ status }: { status: Status }) => (
  <span className={status}>{status}</span>
)`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasEnum = result.some((c) => c.content.includes('enum Status'))
        expect(hasEnum).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('React hooks in components', () => {
    it.effect('handles useState hook', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.content).toContain('useState')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles useEffect hook', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function Timer() {
  const [time, setTime] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTime(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  return <span>{time}s</span>
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.content).toContain('useEffect')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles custom hooks', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function useWindowSize() {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const handler = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return size
}

function ResponsiveComponent() {
  const { width } = useWindowSize()
  return <div>{width > 768 ? 'Desktop' : 'Mobile'}</div>
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasHook = result.some((c) => c.content.includes('useWindowSize'))
        expect(hasHook).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('JSX edge cases', () => {
    it.effect('handles JSX in ternary expression', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function Toggle({ on }: { on: boolean }) {
  return on ? <span>On</span> : <span>Off</span>
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.content).toContain('<span>On</span>')
        expect(result[0]!.content).toContain('<span>Off</span>')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles JSX in logical expression', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function ConditionalRender({ show }: { show: boolean }) {
  return <div>{show && <span>Visible</span>}</div>
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.content).toContain('show &&')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles JSX spread attributes', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function Button(props: ButtonProps) {
  return <button {...props} className="btn" />
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.content).toContain('{...props}')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles JSX with namespaced elements', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function Icon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg">
      <path d="M0 0h24v24H0z" />
    </svg>
  )
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.content).toContain('<svg')
        expect(result[0]!.content).toContain('</svg>')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles JSX with HTML entities', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function Copyright() {
  return <span>&copy; 2024 &mdash; All rights reserved</span>
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.content).toContain('&copy;')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles JSX with computed property names', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function DynamicComponent({ tag: Tag }: { tag: keyof JSX.IntrinsicElements }) {
  return <Tag>Dynamic tag</Tag>
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.content).toContain('<Tag>')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles JSX with data attributes', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function TrackedButton({ id }: { id: string }) {
  return <button data-testid={id} data-analytics="click">Track</button>
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.content).toContain('data-testid')
        expect(result[0]!.content).toContain('data-analytics')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles JSX with aria attributes', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function AccessibleButton() {
  return <button aria-label="Close" aria-pressed={false}>×</button>
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.content).toContain('aria-label')
        expect(result[0]!.content).toContain('aria-pressed')
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('imports and exports with JSX', () => {
    it.effect('handles import statements before component', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `import React from 'react'
import { useState } from 'react'

function Counter() {
  const [count, setCount] = useState(0)
  return <button>{count}</button>
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasImport = result.some((c) => c.content.includes('import'))
        expect(hasImport).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles export default component', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function App() {
  return <div>App</div>
}

export default App`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasExport = result.some((c) =>
          c.content.includes('export default'),
        )
        expect(hasExport).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles named exports', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `export function Button() {
  return <button>Click</button>
}

export const Input = () => <input />`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('complex real-world patterns', () => {
    it.effect('handles compound component pattern', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="card">{children}</div>
)

Card.Header = ({ children }: { children: React.ReactNode }) => (
  <div className="card-header">{children}</div>
)

Card.Body = ({ children }: { children: React.ReactNode }) => (
  <div className="card-body">{children}</div>
)`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasCard = result.some((c) => c.content.includes('Card'))
        expect(hasCard).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles render props pattern', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function MouseTracker({ render }: { render: (pos: { x: number; y: number }) => React.ReactNode }) {
  const [position, setPosition] = useState({ x: 0, y: 0 })

  return (
    <div onMouseMove={(e) => setPosition({ x: e.clientX, y: e.clientY })}>
      {render(position)}
    </div>
  )
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.content).toContain('MouseTracker')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles context provider pattern', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `const ThemeContext = React.createContext<Theme>('light')

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  )
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasProvider = result.some((c) => c.content.includes('Provider'))
        expect(hasProvider).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles HOC pattern', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function withAuth<P extends object>(Component: React.ComponentType<P>) {
  return function AuthenticatedComponent(props: P) {
    const { user } = useAuth()

    if (!user) {
      return <Navigate to="/login" />
    }

    return <Component {...props} />
  }
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.content).toContain('withAuth')
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('error boundary and suspense', () => {
    it.effect('handles error boundary class', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `class ErrorBoundary extends React.Component<Props, State> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return <div>Something went wrong</div>
    }
    return this.props.children
  }
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasBoundary = result.some((c) =>
          c.content.includes('ErrorBoundary'),
        )
        expect(hasBoundary).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles Suspense wrapper', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function App() {
  return (
    <Suspense fallback={<Loading />}>
      <LazyComponent />
    </Suspense>
  )
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.content).toContain('Suspense')
        expect(result[0]!.content).toContain('fallback')
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('line tracking with JSX', () => {
    it.effect('tracks correct line numbers for JSX component', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function Component() {
  return (
    <div>
      Content
    </div>
  )
}`,
          language: 'tsx',
        })

        expect(result.length).toBe(1)
        expect(result[0]!.startLine).toBe(0)
        expect(result[0]!.endLine).toBe(6)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('tracks correct line numbers for multiple components', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function First() {
  return <div>First</div>
}

function Second() {
  return <div>Second</div>
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        const firstChunk = result.find((c) => c.content.includes('First'))
        const secondChunk = result.find((c) => c.content.includes('Second'))

        if (firstChunk && secondChunk && firstChunk !== secondChunk) {
          expect(firstChunk.startLine).toBeLessThan(secondChunk.startLine)
        }
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('id generation with JSX', () => {
    it.effect(
      'generates deterministic ids for different JSX content in same file',
      () =>
        Effect.gen(function* () {
          const chunker = yield* Chunker
          const result1 = yield* chunker.chunk({
            filePath: '/test/component.tsx',
            content: `function A() { return <div>A</div> }`,
            language: 'tsx',
          })
          const result2 = yield* chunker.chunk({
            filePath: '/test/component.tsx',
            content: `function B() { return <div>B</div> }`,
            language: 'tsx',
          })

          expect(result1[0]!.id).toBe('/test/component.tsx__0')
          expect(result2[0]!.id).toBe('/test/component.tsx__0')
        }).pipe(Effect.provide(TestLive)),
    )

    it.effect('generates same id for identical JSX content', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const content = `function Same() { return <div>Same</div> }`

        const result1 = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content,
          language: 'tsx',
        })
        const result2 = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content,
          language: 'tsx',
        })

        expect(result1[0]!.id).toBe(result2[0]!.id)
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('chunk merging with JSX', () => {
    it.effect('merges small JSX components together', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `const A = () => <a>A</a>
const B = () => <b>B</b>
const C = () => <c>C</c>`,
          language: 'tsx',
        })

        expect(result.length).toBeLessThanOrEqual(3)
      }).pipe(Effect.provide(TestLiveLargeChunks)),
    )

    it.effect('keeps large JSX components separate', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const largeComponent = `function LargeComponent() {
  return (
    <div>
      <section>
        <h1>Title that is intentionally very long to push token count</h1>
        <p>Content that is also quite long to ensure we exceed limits</p>
        <p>More content to really make sure this component is large enough</p>
      </section>
    </div>
  )
}`
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content:
            largeComponent +
            '\n\n' +
            largeComponent.replace('LargeComponent', 'AnotherLarge'),
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('empty and edge cases', () => {
    it.effect('handles empty TSX file', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/empty.tsx',
          content: '',
          language: 'tsx',
        })

        expect(result).toEqual([])
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles TSX file with only imports', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/imports.tsx',
          content: `import React from 'react'
import { useState } from 'react'`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        result.forEach((chunk) => {
          const header = extractContextHeader(chunk.content)
          expect(header).toContain('# filePath: /test/imports.tsx')
          expect(header).not.toContain('# scope:')
          expect(chunk.content).toContain('import')
        })
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles TSX file with only types', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/types.tsx',
          content: `type Props = { name: string }
interface State { count: number }`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles component with only comments', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/comments.tsx',
          content: `// This is a comment
/* Multi-line
   comment */
function Empty() {
  // Comment inside
  return null
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles component returning null', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function NullComponent() {
  return null
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.content).toContain('return null')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles component with empty JSX', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function EmptyDiv() {
  return <div></div>
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.content).toContain('<div></div>')
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('JSX chunk splitting behavior', () => {
    it.effect(
      'preserves function declaration when component is split into multiple chunks',
      () =>
        Effect.gen(function* () {
          const chunker = yield* Chunker
          const result = yield* chunker.chunk({
            filePath: '/test/component.tsx',
            content: `function LargeComponent() {
  const aaaaaa = "content"
  const bbbbbb = "content"
  const cccccc = "content"
  const dddddd = "content"
  return <div>Result</div>
}`,
            language: 'tsx',
          })

          expect(result.length).toBeGreaterThanOrEqual(1)
          const combinedContent = result
            .map((chunk) => chunk.content)
            .join('\n')
          expect(combinedContent.includes('function LargeComponent()')).toBe(
            true,
          )
        }).pipe(Effect.provide(TestLiveTinyChunks)),
    )

    it.effect('includes parent function declaration across child chunks', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function Dashboard() {
  const state1 = useState(1)
  const state2 = useState(2)
  const state3 = useState(3)
  return (
    <Layout>
      <Sidebar>Items</Sidebar>
    </Layout>
  )
}`,
          language: 'tsx',
        })

        const combinedContent = result.map((chunk) => chunk.content).join('\n')
        expect(combinedContent.includes('function Dashboard()')).toBe(true)
      }).pipe(Effect.provide(TestLiveTinyChunks)),
    )

    it.effect(
      'splits large component with hooks and JSX preserving declarations',
      () =>
        Effect.gen(function* () {
          const chunker = yield* Chunker
          const result = yield* chunker.chunk({
            filePath: '/test/component.tsx',
            content: `function Counter() {
  const [count, setCount] = useState(0)
  const increment = () => setCount(c => c + 1)
  const decrement = () => setCount(c => c - 1)
  return (
    <div>
      <span>{count}</span>
      <button onClick={increment}>+</button>
      <button onClick={decrement}>-</button>
    </div>
  )
}`,
            language: 'tsx',
          })

          expect(result.length).toBeGreaterThanOrEqual(1)
          const combinedContent = result
            .map((chunk) => chunk.content)
            .join('\n')
          expect(combinedContent.includes('function Counter()')).toBe(true)
        }).pipe(Effect.provide(TestLiveTinyChunks)),
    )

    it.effect('maintains correct line numbers across split chunks', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function Multi() {
  const x = 1
  const y = 2
  const z = 3
  return <div>{x + y + z}</div>
}`,
          language: 'tsx',
        })

        if (result.length > 1) {
          const sortedByLine = [...result].sort(
            (a, b) => a.startLine - b.startLine,
          )
          for (let i = 1; i < sortedByLine.length; i++) {
            expect(sortedByLine[i]!.startLine).toBeGreaterThanOrEqual(
              sortedByLine[i - 1]!.startLine,
            )
          }
        }
      }).pipe(Effect.provide(TestLiveTinyChunks)),
    )

    it.effect('context header includes nested structure identifiers', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `class MyClass {
  render() {
    const a = 1
    const b = 2
    return <div>{a + b}</div>
  }
}`,
          language: 'tsx',
        })

        const hasMyClass = result.some((chunk) =>
          chunk.content.includes('class MyClass'),
        )
        expect(hasMyClass).toBe(true)
      }).pipe(Effect.provide(TestLiveTinyChunks)),
    )

    it.effect('handles multiple functions with tiny chunks', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/component.tsx',
          content: `function First() {
  return <a>First</a>
}

function Second() {
  return <b>Second</b>
}`,
          language: 'tsx',
        })

        expect(result.length).toBeGreaterThanOrEqual(2)
        const hasFirst = result.some((c) => c.content.includes('First'))
        const hasSecond = result.some((c) => c.content.includes('Second'))
        expect(hasFirst).toBe(true)
        expect(hasSecond).toBe(true)
      }).pipe(Effect.provide(TestLiveTinyChunks)),
    )
  })
})
