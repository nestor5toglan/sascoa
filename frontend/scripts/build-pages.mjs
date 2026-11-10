import { mkdir, readFile, writeFile } from 'node:fs/promises'
import pages from '../src/router/publicPages.json' with { type: 'json' }

const dist = new URL('../dist/', import.meta.url)
const home = await readFile(new URL('index.html', dist), 'utf8')
const origin = 'https://sascoa.com'
const url = (path) => origin + (path === '/' ? path : path + '/')
const escape = (text) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
const write = (path, content) => writeFile(new URL(path, dist), content)

function page(title, description, extra) {
  return home
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escape(title)}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/, () =>
      description ? `<meta name="description" content="${escape(description)}" />` : '',
    )
    .replace('</head>', () => `  ${extra}\n  </head>`)
}

async function writePage(path, html) {
  const dir = path.slice(1)
  if (dir) await mkdir(new URL(dir + '/', dist), { recursive: true })
  await write(dir ? dir + '/index.html' : 'index.html', html)
}

for (const [path, { title, description }] of Object.entries(pages)) {
  await writePage(path, page(title, description, `<link rel="canonical" href="${url(path)}" />`))
}
await writePage(
  '/salons',
  page(
    pages['/evenements'].title,
    pages['/evenements'].description,
    `<link rel="canonical" href="${url('/evenements')}" />`,
  ),
)

const admin = [
  '',
  'connexion',
  'tableau-de-bord',
  'candidatures/pitch',
  'candidatures/hackathon',
  'exposants',
  'partenaires',
  'preinscriptions',
  'pages/contact',
  'pages/a-propos',
  'messages',
  'secteurs',
  'entreprises',
  'evenements',
  'pages/pitch',
  'pages/hackathon',
]
for (const route of admin) {
  await writePage(
    '/administration' + (route ? '/' + route : ''),
    page('Administration | SASCOA', '', '<meta name="robots" content="noindex" />'),
  )
}
await write(
  '404.html',
  page('Page introuvable | SASCOA', '', '<meta name="robots" content="noindex" />'),
)

await write(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Object.keys(pages)
  .map((path) => `  <url><loc>${url(path)}</loc></url>`)
  .join('\n')}
</urlset>
`,
)
await write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`)
