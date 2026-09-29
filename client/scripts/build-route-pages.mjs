import { readFile, mkdir, copyFile } from 'node:fs/promises'

// Vercel Services does not apply the standalone Vite SPA fallback. Give every
// declared client route an entry file so direct links and refreshes work too.
const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const dist = new URL('../dist/', import.meta.url)
const routes = [...app.matchAll(/<Route\s+path=['"]([^'"]+)['"]/g)].map(match => match[1])
for (const route of routes) {
  if (route === '/') continue
  if (/[:*]/.test(route)) throw new Error(`Dynamic route needs a hosting fallback: ${route}`)
  const destination = new URL(`.${route}/`, dist)
  await mkdir(destination, { recursive: true })
  await copyFile(new URL('index.html', dist), new URL('index.html', destination))
}
console.log(`Created entry pages for ${routes.length} client routes.`)
