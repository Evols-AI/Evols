import Head from 'next/head'
import Link from 'next/link'
import Image from 'next/image'
import { GetStaticPaths, GetStaticProps } from 'next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import { ArrowLeft } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { getAllPosts, getPostBySlug } from '@/content/blog/blog'
import type { BlogPost } from '@/content/blog/blog'

interface Props {
  post: BlogPost
}

const mdComponents: Components = {
  img({ src, alt }) {
    if (!src) return null
    return (
      <span className="block my-8">
        <Image
          src={src}
          alt={alt ?? ''}
          width={0}
          height={0}
          sizes="(max-width: 768px) 100vw, 672px"
          className="w-full h-auto rounded-xl"
        />
      </span>
    )
  },
}

export default function BlogPostPage({ post }: Props) {
  const { theme } = useTheme()
  const dark = theme === 'dark'

  const textFaint = dark ? 'text-white/40' : 'text-black/40'
  const border = dark ? 'border-white/10' : 'border-black/10'

  const formattedDate = new Date(post.date + 'T12:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const canonicalUrl = post.canonicalUrl ?? `https://evols.ai/blog/${post.slug}`

  return (
    <>
      <Head>
        <title>{post.title} - Evols Blog</title>
        <meta name="description" content={post.description} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.description} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="article:published_time" content={post.date} />
        <meta property="article:author" content={post.author} />
        {post.tags.map(tag => (
          <meta key={tag} property="article:tag" content={tag} />
        ))}
        <style>{`h1,h2,h3,h4,h5,h6{font-family:'Syne',system-ui,sans-serif!important}`}</style>
      </Head>

      <div className="min-h-screen bg-background">
        <Header variant="landing" />

        <main className="container mx-auto px-6 pt-28 pb-20">
          <div className="max-w-2xl mx-auto">

            <Link href="/blog"
              className={`inline-flex items-center gap-1.5 text-sm ${textFaint} hover:text-foreground transition-colors mb-10`}>
              <ArrowLeft className="w-3.5 h-3.5" />
              All posts
            </Link>

            <div className="mb-10">
              <div className="flex items-center gap-3 mb-5">
                <span className={`text-xs ${textFaint}`}>{formattedDate}</span>
                <span className={`text-xs ${textFaint}`}>•</span>
                <span className={`text-xs ${textFaint}`}>{post.readingTime}</span>
              </div>
              <h1 className="text-4xl font-medium leading-tight text-foreground mb-4">
                {post.title}
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                {post.description}
              </p>
              <div className="flex items-center gap-4 pb-8 border-b border-border">
                <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary text-sm font-medium">
                  {post.author.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{post.author}</p>
                  {post.authorRole && (
                    <p className={`text-xs ${textFaint}`}>{post.authorRole}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="blog-prose">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                {post.content}
              </ReactMarkdown>
            </div>

            <div className={`mt-12 pt-8 border-t ${border} flex flex-wrap gap-2`}>
              {post.tags.map(tag => (
                <span key={tag}
                  className={`text-xs px-2.5 py-1 rounded-full border ${border} ${dark ? 'bg-white/[0.04]' : 'bg-black/[0.03]'} text-muted-foreground`}>
                  {tag}
                </span>
              ))}
            </div>

            <div className={`mt-10 p-6 rounded-xl border ${border} ${dark ? 'bg-white/[0.02]' : 'bg-black/[0.02]'}`}>
              <p className="text-sm font-medium text-foreground mb-1">Try Evols for your team</p>
              <p className={`text-sm ${textFaint} mb-4`}>
                Give your team an AI that remembers your context, decisions, and product knowledge.
              </p>
              <Link href="/register"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/85 transition-all">
                Get early access
              </Link>
            </div>

          </div>
        </main>

        <Footer />
      </div>
    </>
  )
}

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = getAllPosts()
  return {
    paths: posts.map(p => ({ params: { slug: p.slug } })),
    fallback: false,
  }
}

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const post = getPostBySlug(params!.slug as string)
  if (!post) return { notFound: true }
  return { props: { post } }
}
