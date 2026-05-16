/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://evols.ai',
  generateRobotsTxt: false,
  changefreq: 'weekly',
  priority: 0.7,
  exclude: [
    '/admin',
    '/admin/*',
    '/admin-setup',
    '/auth/*',
    '/dashboard',
    '/context',
    '/knowledge',
    '/work-context',
    '/settings',
    '/skills',
    '/workbench',
    '/register',
    '/login',
  ],
  additionalPaths: async () => [
    { loc: '/', changefreq: 'weekly', priority: 1.0 },
    { loc: '/blog', changefreq: 'daily', priority: 0.9 },
    { loc: '/docs', changefreq: 'weekly', priority: 0.8 },
    { loc: '/glossary', changefreq: 'monthly', priority: 0.7 },
  ],
}
