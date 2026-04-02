import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="description" content="Evols - Evolve your product roadmap. Turn customer feedback into prioritized roadmaps automatically." />
        <link rel="icon" href="/favicon.ico" />
        {/* Typography */}
        {/* Manrope for body text, GT Alpina Standard for headings (falls back to Georgia) */}
        {/* Courgette for logo */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Courgette:wght@400&family=Manrope:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        {/* GT Alpina Standard is a commercial font - add @font-face in globals.css if self-hosting */}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
