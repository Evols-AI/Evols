import Head from 'next/head'
import Link from 'next/link'
import { GetStaticProps } from 'next'
import { BookOpen } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import SpotlightCard from '@/components/SpotlightCard'
import { getAllPosts } from '@/content/blog/blog'
import type { BlogPost } from '@/content/blog/blog'

interface Props {
  posts: Omit<BlogPost, 'content'>[]
}

export default function BlogIndex({ posts }: Props) {
  const { theme } = useTheme()
  const dark = theme === 'dark'

  const textFaint = dark ? 'text-white/40' : 'text-black/40'
  const border = dark ? 'border-white/10' : 'border-black/10'

  return (
    <>
      <Head>
        <title>Blog - Evols</title>
        <meta name="description" content="Insights on AI for product teams, knowledge management, and the future of product management." />
        <link rel="canonical" href="https://evols.ai/blog" />
      </Head>

      <div className="min-h-screen bg-background">
        <Header variant="landing" />

        <main className="container mx-auto px-6 pt-28 pb-20">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full text-sm text-primary mb-6">
              <BookOpen className="w-4 h-4" />
              <span>Blog</span>
            </div>
            <h1 className="text-5xl font-medium mb-4 text-foreground">Evols Blog</h1>
            <p className="text-xl max-w-2xl mx-auto text-muted-foreground">
              Insights on AI for product teams, knowledge management, and what good looks like when AI actually knows your context.
            </p>
          </div>

          <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map(post => (
              <PostCard key={post.slug} post={post} dark={dark} border={border} textFaint={textFaint} />
            ))}
          </div>
        </main>

        <Footer />
      </div>
    </>
  )
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  const posts = getAllPosts().map(({ content: _content, ...rest }) => rest)
  return { props: { posts } }
}

function PostCard({ post, dark, border, textFaint }: {
  post: Omit<BlogPost, 'content'>
  dark: boolean
  border: string
  textFaint: string
}) {
  const formattedDate = new Date(post.date + 'T12:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <SpotlightCard className="h-full">
      <Link href={`/blog/${post.slug}`} className="group flex flex-col h-full">
        {/* Thumbnail */}
        <div className={`w-full h-44 overflow-hidden rounded-t-xl flex-shrink-0 ${dark ? 'bg-white/5' : 'bg-black/5'}`}>
          {post.firstImage ? (
            <img
              src={post.firstImage}
              alt={post.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="w-10 h-10 text-primary/30" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs ${textFaint}`}>{formattedDate}</span>
            <span className={`text-xs ${textFaint}`}>•</span>
            <span className={`text-xs ${textFaint}`}>{post.readingTime}</span>
          </div>
          <h2 className="text-base font-medium text-foreground mb-2 group-hover:text-primary transition-colors leading-snug">
            {post.title}
          </h2>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed line-clamp-3 flex-1">{post.description}</p>
          <div className="flex items-center justify-between mt-auto">
            <div className="flex gap-1.5 flex-wrap">
              {post.tags.slice(0, 2).map(tag => (
                <span key={tag}
                  className={`text-xs px-2 py-0.5 rounded-full border ${border} ${dark ? 'bg-white/[0.04]' : 'bg-black/[0.03]'} text-muted-foreground`}>
                  {tag}
                </span>
              ))}
            </div>
            <span className="text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity font-medium flex-shrink-0">
              Read →
            </span>
          </div>
        </div>
      </Link>
    </SpotlightCard>
  )
}
