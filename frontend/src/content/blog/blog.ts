import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

// gray-matter parses YAML date fields as JS Date objects (UTC midnight).
// Calling String() on them produces a locale timezone string that breaks slice(0,10).
// Always use toISOString() for Date instances to stay in UTC.
function toISODate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).slice(0, 10)
}

export interface BlogPost {
  slug: string
  title: string
  description: string
  date: string        // ISO date string e.g. "2026-04-20"
  author: string
  authorRole: string | null
  readingTime: string
  tags: string[]
  content: string     // raw markdown body (no frontmatter)
  canonicalUrl: string | null
}

const CONTENT_DIR = path.join(process.cwd(), 'src/content/blog')

export function getAllPosts(): BlogPost[] {
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'))

  const posts: BlogPost[] = []

  for (const filename of files) {
    const slug = filename.replace(/\.md$/, '')
    try {
      const raw = fs.readFileSync(path.join(CONTENT_DIR, filename), 'utf-8')
      const { data, content } = matter(raw)
      if (!data.title || !data.date) {
        console.warn(`[blog] skipping ${filename}: missing required frontmatter (title, date)`)
        continue
      }
      posts.push({
        slug,
        title: data.title as string,
        description: data.description as string,
        date: toISODate(data.date),
        author: data.author as string,
        authorRole: (data.authorRole as string) ?? null,
        readingTime: data.readingTime as string,
        tags: (data.tags as string[]) ?? [],
        canonicalUrl: (data.canonicalUrl as string) ?? null,
        content: content.trim(),
      })
    } catch (err) {
      console.error(`[blog] failed to parse ${filename}:`, err)
    }
  }

  return posts.sort((a, b) => (a.date < b.date ? 1 : -1))
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  const filepath = path.join(CONTENT_DIR, `${slug}.md`)
  if (!fs.existsSync(filepath)) return undefined

  const raw = fs.readFileSync(filepath, 'utf-8')
  const { data, content } = matter(raw)

  return {
    slug,
    title: data.title as string,
    description: data.description as string,
    date: toISODate(data.date),
    author: data.author as string,
    authorRole: (data.authorRole as string) ?? null,
    readingTime: data.readingTime as string,
    tags: (data.tags as string[]) ?? [],
    canonicalUrl: (data.canonicalUrl as string) ?? null,
    content: content.trim(),
  }
}
