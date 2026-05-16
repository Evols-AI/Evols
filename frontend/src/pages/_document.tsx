import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="description" content="Evols AI — The team AI operating system. Eliminate the handoff tax. Turn every AI session into team intelligence." />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        {/* Default OG / Twitter card — individual pages override these */}
        <meta property="og:site_name" content="Evols AI" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://evols.ai/og-default.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Evols AI — Team AI Brain" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@EvolsAI" />
        <meta name="twitter:image" content="https://evols.ai/og-default.png" />
        {/* Typography */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=Sora:wght@400;500;600;700;800&family=Syne:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
