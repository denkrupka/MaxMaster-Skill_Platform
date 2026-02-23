import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BASE = 'https://www.atutrental.com.pl'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'

// ═══ FETCH HELPER ═══
async function fetchHTML(path: string): Promise<string> {
  const url = path.startsWith('http') ? path : BASE + path
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,*/*',
      'Accept-Language': 'pl-PL,pl;q=0.9',
    },
    redirect: 'follow',
  })
  return res.text()
}

// ═══ IMAGE FILTER ═══
const JUNK = [
  'shopping-cart', 'logo-footer', 'autograph', 'Mockup', 'discount',
  'appstore', 'googleplay', 'white-pin', 'phone.png', 'email.png',
  'Grupa-83', 'koparka', 'building', 'calendar', 'profesional',
  'van.png', 'van-white', 'slash.png', 'tiny-logo', 'map.png',
  'koparka-white', 'building-white',
]

function isGoodImage(url: string): boolean {
  if (!url) return false
  if (url.endsWith('.svg')) return false
  if (JUNK.some(j => url.includes(j))) return false
  return true
}

// ═══ REGEX-BASED HTML PARSERS ═══

function isProductPage(html: string): boolean {
  return html.includes('product__aside__rental') || html.includes('product_rent__right_box')
}

// Extract data-lazy-bg from element-level string
function extractImagesFromBlock(block: string): string[] {
  const imgs: string[] = []
  // data-lazy-bg="URL"
  const bgMatches = block.matchAll(/data-lazy-bg="([^"]+)"/g)
  for (const m of bgMatches) {
    if (isGoodImage(m[1]) && !imgs.includes(m[1])) imgs.push(m[1])
  }
  // style="...background-image: url(URL)..."
  const styleMatches = block.matchAll(/background-image:\s*url\(['"]?(https?:\/\/[^'")\s]+)/g)
  for (const m of styleMatches) {
    if (isGoodImage(m[1]) && !imgs.includes(m[1])) imgs.push(m[1])
  }
  // <img src="URL">
  const imgMatches = block.matchAll(/<img[^>]+(?:src|data-lazy)="([^"]+)"/g)
  for (const m of imgMatches) {
    if (isGoodImage(m[1]) && !imgs.includes(m[1])) imgs.push(m[1])
  }
  return imgs
}

// ═══ BREADCRUMB ═══
function parseBreadcrumb(html: string): Array<{ slug: string; name: string }> {
  const bc: Array<{ slug: string; name: string }> = []
  const section = html.match(/class="bread-crums"[^>]*>([\s\S]*?)<\/(?:div|nav|ul)>/i)
  if (!section) return bc
  const linkRe = /<a[^>]+href="([^"]*)"[^>]*>([^<]+)<\/a>/gi
  let m
  while ((m = linkRe.exec(section[1])) !== null) {
    const name = m[2].trim()
    if (!name || name.includes('Strona główna')) continue
    try {
      const slug = new URL(m[1]).pathname
      bc.push({ slug, name })
    } catch { /* skip */ }
  }
  return bc
}

// ═══ LIST PAGE ═══
function parseListPage(html: string, requestedSlug: string) {
  // Title from <h1>
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  const title = h1Match ? h1Match[1].replace(/<[^>]*>/g, '').trim() : ''
  const breadcrumb = parseBreadcrumb(html)

  const skipTexts = new Set([
    'Wynajem', 'Sprzedaż', 'Bobcat', 'Serwis', 'O firmie', 'Kontakt', 'BLOG',
    'Dlaczego Atut Rental?', 'Aplikacja ATUTGO', 'Dlaczego wynajem?',
    'Pytania i odpowiedzi', 'Warunki najmu', 'Do pobrania',
    'więcej wyników', 'szukaj', 'zobacz', '0',
    'Serwis na budowie', 'Przeglądy okresowe', 'Oryginalne części zamienne',
    'Gruntowne remonty maszyn', 'O nas', 'Aktualności', 'Historia',
    'Nasze realizacje', 'Działalność społeczna', 'PSBW', 'Kariera',
  ])
  const skipPaths = ['dlaczego', 'pytania', 'warunki', 'pobrania', 'aplikacja', 'firma', 'kontakt', 'serwis/', 'blog', 'sprzedaz', 'bobcat', 'koszyk', 'wyniki']

  // Strategy 1: Product cards with prices ("zł")
  const products: any[] = []
  const pSeen = new Set<string>()

  // Find all <a> blocks linking to /wynajem/ that contain "zł"
  const linkRe = /<a\s[^>]*href="([^"]*\/wynajem\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
  let lm
  while ((lm = linkRe.exec(html)) !== null) {
    const fullText = lm[2].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    if (!fullText.includes('zł')) continue
    let pathname: string
    try { pathname = new URL(lm[1]).pathname } catch { continue }
    if (pSeen.has(pathname)) continue
    pSeen.add(pathname)

    const lines = fullText.split(/\s{2,}/).map((l: string) => l.trim()).filter(Boolean)
    const name = lines[0] || ''
    if (!name || name.length < 3 || name.length > 120) continue

    let priceNetto: number | null = null
    let priceBrutto: number | null = null
    const nm = fullText.match(/([\d]+[,.]?[\d]*)\s*zł\s*netto/i)
    const bm = fullText.match(/([\d]+[,.]?[\d]*)\s*zł\s*brutto/i)
    if (nm) priceNetto = parseFloat(nm[1].replace(',', '.'))
    if (bm) priceBrutto = parseFloat(bm[1].replace(',', '.'))

    // Specs from <strong>/<b>
    const specs: string[] = []
    const strongRe = /<(?:strong|b)[^>]*>([^<]+)<\/(?:strong|b)>/gi
    let sm
    while ((sm = strongRe.exec(lm[2])) !== null) {
      const v = sm[1].trim()
      if (v && !v.includes('zł') && v !== 'zobacz' && v.length < 50) specs.push(v)
    }

    const imgs = extractImagesFromBlock(lm[2])
    products.push({
      slug: pathname, name, image: imgs[0] || '',
      priceNetto, priceBrutto, priceUnit: 'DOBA', specs,
      price: priceNetto ? priceNetto.toFixed(2).replace('.', ',') + ' zł netto' : '',
    })
  }

  if (products.length > 0) {
    return { title, breadcrumb, items: products, hasProducts: true }
  }

  // Strategy 2: Category tiles
  const allLinks: any[] = []
  const catLinkRe = /<a\s[^>]*href="([^"]*\/wynajem\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
  let cm
  while ((cm = catLinkRe.exec(html)) !== null) {
    // Skip nav/header/footer links
    const preceding200 = html.substring(Math.max(0, cm.index - 200), cm.index)
    if (/(?:header|footer|nav|aside|sidebar)/i.test(preceding200)) continue

    let pathname: string
    try { pathname = new URL(cm[1]).pathname } catch { continue }
    if (!pathname.startsWith('/wynajem/')) continue

    const text = cm[2].replace(/<[^>]*>/g, ' ').trim().split('\n')[0].trim()
    if (!text || text.length < 2 || text.length > 120) continue
    if (skipTexts.has(text)) continue
    if (skipPaths.some(s => pathname.includes(s))) continue
    if (pathname === requestedSlug) continue

    const imgs = extractImagesFromBlock(cm[2])
    allLinks.push({ slug: pathname, name: text, image: imgs[0] || '', price: '' })
  }

  // Dedup: prefer entry WITH image
  const bySlug = new Map<string, any>()
  for (const l of allLinks) {
    const existing = bySlug.get(l.slug)
    if (!existing || (!existing.image && l.image)) {
      bySlug.set(l.slug, l)
    }
  }
  let items = Array.from(bySlug.values())

  // Always filter to children of the current slug to avoid showing siblings
  const slug = (requestedSlug || '/wynajem/').replace(/\/$/, '')
  if (slug === '/wynajem') {
    const topLevel = items.filter((i: any) => i.slug.replace(/\/$/, '').split('/').filter(Boolean).length === 2)
    if (topLevel.length > 0) items = topLevel
  } else {
    const ch = items.filter((i: any) => i.slug.startsWith(slug + '/') && i.slug !== slug + '/')
    if (ch.length > 0) items = ch
  }

  // If no child links found, check if items are actually products (last-level page)
  // by detecting if any items have product-like URLs or image patterns
  if (items.length === 0 && allLinks.length > 0) {
    // This is likely a product listing page where products weren't detected by Strategy 1
    // Return all filtered links as products
    const productLike = allLinks.filter((i: any) => {
      const parts = i.slug.replace(/\/$/, '').split('/').filter(Boolean)
      return parts.length >= 3 && i.slug !== requestedSlug
    })
    if (productLike.length > 0) {
      return { title, breadcrumb, items: productLike, hasProducts: true }
    }
  }

  return { title, breadcrumb, items, hasProducts: false }
}

// ═══ PRODUCT PAGE ═══
function parseProductPage(html: string) {
  const p: Record<string, any> = {}

  // Title
  const h1m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  p.title = h1m ? h1m[1].replace(/<[^>]*>/g, '').trim() : ''

  // Product ID from h1 data-irs
  const irsM = html.match(/<h1[^>]+data-irs="([^"]+)"/i)
  p.productId = irsM ? irsM[1] : ''

  p.breadcrumb = parseBreadcrumb(html)

  // Prices
  p.priceNetto = null
  p.priceBrutto = null
  p.priceUnit = 'DOBA'

  // Net price block
  const netBlock = html.match(/product__aside__rental--net([\s\S]*?)(?=product__aside__rental--|<\/div>\s*<\/div>)/i)
  if (netBlock) {
    const priceM = netBlock[1].match(/product__aside__rental__price[^>]*>([^<]*)/i)
    if (priceM) {
      const val = priceM[1].replace(/\s/g, '').match(/([\d,\.]+)/)
      if (val) p.priceNetto = parseFloat(val[1].replace(',', '.'))
    }
    const unitM = netBlock[1].match(/product__aside__rental__type[^>]*>([^<]*)/i)
    if (unitM) {
      const u = unitM[1].replace(/&nbsp;/g, ' ').trim().replace(/^netto\/?/i, '').trim()
      if (u) p.priceUnit = u
    }
  }

  // Gross price block
  const grossBlock = html.match(/product__aside__rental--gross([\s\S]*?)(?=<\/div>\s*<\/div>)/i)
  if (grossBlock) {
    const priceM = grossBlock[1].match(/product__aside__rental__price[^>]*>([^<]*)/i)
    if (priceM) {
      const val = priceM[1].replace(/\s/g, '').match(/([\d,\.]+)/)
      if (val) p.priceBrutto = parseFloat(val[1].replace(',', '.'))
    }
  }

  // Images
  p.images = []

  // carousel--big--rent__item with data-lazy-bg
  const carouselBigRe = /carousel--big--rent__item[^"]*"[^>]*data-lazy-bg="([^"]+)"/gi
  let cm
  while ((cm = carouselBigRe.exec(html)) !== null) {
    if (isGoodImage(cm[1]) && !p.images.includes(cm[1])) p.images.push(cm[1])
  }

  // carousel--small--rent__item with data-lazy-bg
  const carouselSmRe = /carousel--small--rent__item[^"]*"[^>]*data-lazy-bg="([^"]+)"/gi
  while ((cm = carouselSmRe.exec(html)) !== null) {
    if (isGoodImage(cm[1]) && !p.images.includes(cm[1])) p.images.push(cm[1])
  }

  // og:image fallback
  const ogM = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)
  if (ogM && isGoodImage(ogM[1]) && !p.images.includes(ogM[1])) {
    if (p.images.length === 0) p.images.push(ogM[1])
  }

  // Last resort: data-lazy-bg with uploads or irs_category_img
  if (p.images.length === 0) {
    const lazyRe = /data-lazy-bg="([^"]+)"/gi
    while ((cm = lazyRe.exec(html)) !== null) {
      if (isGoodImage(cm[1]) && (cm[1].includes('/uploads/') || cm[1].includes('irs_category_img')) && !p.images.includes(cm[1])) {
        p.images.push(cm[1])
      }
    }
  }

  p.image = p.images[0] || ''

  // Brand
  p.brand = ''
  const brandM = html.match(/product_rent__header[^>]*>[^]*?[Pp]roducent[:\s]+(?:<[^>]*>)*\s*([^<]+)/i)
  if (brandM) p.brand = brandM[1].trim()
  if (!p.brand) {
    const brandM2 = html.match(/product_rent__smalltext[^>]*>([^<]+)/i)
    // Only use if close to "Producent" text
    if (brandM2) {
      const idx = html.indexOf(brandM2[0])
      const before = html.substring(Math.max(0, idx - 200), idx)
      if (/[Pp]roducent/i.test(before)) p.brand = brandM2[1].trim()
    }
  }

  // Description (skip <style> tags, only match in <p>/<div>/<span>)
  p.description = ''
  // Method 1: <p class="product_rent__text">
  const descM = html.match(/<(?:p|div|span)[^>]*class="[^"]*product_rent__text[^"]*"[^>]*>([\s\S]*?)<\/(?:p|div|span)>/i)
  if (descM) {
    const txt = descM[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    if (txt.length > 5 && !txt.includes('{') && !txt.includes('background-image')) {
      p.description = txt
    }
  }
  // Method 2: text after OPIS PRODUKTU header
  if (!p.description) {
    const opisIdx = html.search(/product_rent__header[^>]*>[^]*?[Oo]pis/i)
    if (opisIdx > -1) {
      const after = html.substring(opisIdx, opisIdx + 2000)
      const nextTag = after.match(/<(?:p|div|span)[^>]*>([^<]{10,})<\/(?:p|div|span)>/i)
      if (nextTag) {
        const txt = nextTag[1].trim()
        if (!txt.includes('{') && !txt.includes('background-image')) {
          p.description = txt
        }
      }
    }
  }

  // Parameters
  p.params = []
  const paramRe = /product_rent__right_box__description__text[^>]*>([^<]+)/gi
  const paramValues: string[] = []
  let pm
  while ((pm = paramRe.exec(html)) !== null) {
    paramValues.push(pm[1].trim())
  }
  for (let i = 0; i < paramValues.length - 1; i += 2) {
    const n = paramValues[i].replace(/:$/, '').trim()
    const v = paramValues[i + 1].trim()
    if (n && v) p.params.push({ name: n, value: v })
  }

  // Ribbon
  const ribbonM = html.match(/product__aside__ribbon__text[^>]*>([^<]+)/i)
  p.ribbon = ribbonM ? ribbonM[1].trim() : ''

  // Similar products
  p.similar = []
  const similarRe = /class="[^"]*rent_like[^"]*"[^>]*>([\s\S]*?)<\/a>/gi
  let sim
  while ((sim = similarRe.exec(html)) !== null) {
    const hrefM = sim[0].match(/href="([^"]*\/wynajem\/[^"]*)"/)
    const nameM = sim[1].match(/rent_like__text[^>]*>([^<]+)/i)
    if (hrefM && nameM) {
      try {
        const slug = new URL(hrefM[1]).pathname
        const imgs = extractImagesFromBlock(sim[1])
        p.similar.push({ slug, name: nameM[1].trim(), image: imgs[0] || '' })
      } catch { /* skip */ }
    }
  }

  p.contactOnly = !p.priceNetto && !p.priceBrutto
  return p
}

// ═══ RESPONSE HELPERS ═══
function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

function errorResponse(message: string, status = 400): Response {
  return json({ error: message }, status)
}

// ═══ MAIN HANDLER ═══
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { action } = body

    switch (action) {
      // ═══ CATEGORIES (top-level rental categories) ═══
      case 'categories': {
        const html = await fetchHTML('/wynajem/')
        const list = parseListPage(html, '/wynajem/')
        // Filter: only direct children of /wynajem/
        const categories = list.items
          .filter((i: any) => {
            const parts = i.slug.replace(/\/$/, '').split('/').filter(Boolean)
            return parts.length === 2 // ['wynajem', 'category']
          })
          .map((i: any) => ({
            name: i.name,
            slug: i.slug,
            image: i.image,
          }))
        return json({ categories, total: categories.length })
      }

      // ═══ BROWSE (navigate into category or get products) ═══
      case 'browse': {
        const { slug } = body
        if (!slug) return errorResponse('Missing slug')
        const path = slug.startsWith('/') ? slug : '/' + slug
        const html = await fetchHTML(path)

        if (isProductPage(html)) {
          const product = parseProductPage(html)
          return json({ type: 'product', product })
        } else {
          const list = parseListPage(html, path)
          return json({ type: 'list', ...list })
        }
      }

      // ═══ PRODUCT DETAIL ═══
      case 'product': {
        const { slug } = body
        if (!slug) return errorResponse('Missing slug')
        const path = slug.startsWith('/') ? slug : '/' + slug
        const html = await fetchHTML(path)
        const product = parseProductPage(html)
        return json({ product })
      }

      // ═══ SEARCH ═══
      case 'search': {
        const { q } = body
        if (!q) return errorResponse('Missing q')
        // Atut doesn't have a dedicated search API, use site search URL
        const html = await fetchHTML(`/wyniki-wyszukiwania?search=${encodeURIComponent(q)}`)
        const list = parseListPage(html, '/wyniki-wyszukiwania')
        return json({ products: list.items, query: q, total: list.items.length })
      }

      default:
        return errorResponse(`Unknown action: ${action}`)
    }
  } catch (error) {
    const msg = (error as Error).message || String(error)
    console.error('atut-proxy error:', msg)
    return new Response(
      JSON.stringify({ error: msg }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
