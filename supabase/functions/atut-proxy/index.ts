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

// ═══ HTML CLEANER (strip <style>/<script> to prevent regex matching CSS rules) ═══
function cleanHTML(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
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
  html = cleanHTML(html)

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
  // Uses position-based block scanning to handle nested <a> tags
  // (site has <a class="awsm-b-job-item"><h2><a>Title</a></h2>...prices...</a>)
  const products: any[] = []
  const pSeen = new Set<string>()

  // Collect all <a href="/wynajem/..."> opening tag positions
  const openTagRe = /<a\s[^>]*href="([^"]*\/wynajem\/[^"]*)"[^>]*>/gi
  const linkOpenings: Array<{ pathname: string; idx: number; endIdx: number }> = []
  let otm
  while ((otm = openTagRe.exec(html)) !== null) {
    let pathname: string
    try { pathname = new URL(otm[1]).pathname } catch {
      if (otm[1].startsWith('/')) pathname = otm[1]
      else continue
    }
    linkOpenings.push({ pathname, idx: otm.index, endIdx: otm.index + otm[0].length })
  }

  for (let i = 0; i < linkOpenings.length; i++) {
    const cur = linkOpenings[i]
    if (pSeen.has(cur.pathname)) continue
    if (cur.pathname === requestedSlug) continue
    if (skipPaths.some(s => cur.pathname.includes(s))) continue

    // Block boundary: next link with DIFFERENT pathname, or +3000 chars
    let blockEnd = cur.idx + 3000
    for (let j = i + 1; j < linkOpenings.length; j++) {
      if (linkOpenings[j].pathname !== cur.pathname) {
        blockEnd = linkOpenings[j].idx
        break
      }
    }

    const block = html.substring(cur.endIdx, blockEnd)
    const fullText = block.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    if (!fullText.includes('zł')) continue

    // Extract name: try common product title patterns
    let name = ''
    // 1. Heading tags
    const h2m = block.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i)
    if (h2m) name = h2m[1].replace(/<[^>]*>/g, '').trim()
    // 2. Dedicated title div (products_rent__item__title, awsm-b-job-post-title, etc.)
    if (!name) {
      const titleM = block.match(/(?:__title|item-title|post-title)[^>]*>([\s\S]*?)<\/(?:div|span|h\d)>/i)
      if (titleM) name = titleM[1].replace(/<[^>]*>/g, '').trim()
    }
    // 3. Inner <a> linking to /wynajem/ (not generic <a> which could match footer links)
    if (!name) {
      const innerA = block.match(/<a\s[^>]*href="[^"]*\/wynajem\/[^"]*"[^>]*>([^<]{3,})<\/a>/i)
      if (innerA) name = innerA[1].trim()
    }
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
    while ((sm = strongRe.exec(block)) !== null) {
      const v = sm[1].trim()
      if (v && !v.includes('zł') && v !== 'zobacz' && v.length < 50) specs.push(v)
    }

    const imgs = extractImagesFromBlock(block)
    pSeen.add(cur.pathname)
    products.push({
      slug: cur.pathname, name, image: imgs[0] || '',
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

  // Always filter to children of the current slug — never show siblings
  const slug = (requestedSlug || '/wynajem/').replace(/\/$/, '')
  if (slug === '/wynajem') {
    const topLevel = items.filter((i: any) => i.slug.replace(/\/$/, '').split('/').filter(Boolean).length === 2)
    if (topLevel.length > 0) items = topLevel
  } else {
    // Only keep links that are CHILDREN of the current path
    items = items.filter((i: any) => {
      const normSlug = i.slug.replace(/\/$/, '')
      return normSlug.startsWith(slug + '/') && normSlug !== slug
    })
  }

  // If no child links found, this is likely a product listing page
  // (last-level category where products are shown)
  if (items.length === 0) {
    // Strategy 2b: Try to find product-like items WITH images from allLinks
    // Content-area items have images, sidebar items don't
    const withImages = allLinks.filter((i: any) => i.image && i.slug !== requestedSlug)
    if (withImages.length > 0) {
      return { title, breadcrumb, items: withImages, hasProducts: true }
    }

    // Strategy 2c: Look for any product links deeper than current path in ALL links
    const childProducts = allLinks.filter((i: any) => {
      const normSlug = i.slug.replace(/\/$/, '')
      return normSlug.startsWith(slug + '/') && normSlug !== slug
    })
    if (childProducts.length > 0) {
      return { title, breadcrumb, items: childProducts, hasProducts: true }
    }
  }

  return { title, breadcrumb, items, hasProducts: false }
}

// ═══ PRODUCT PAGE ═══
function parseProductPage(html: string) {
  html = cleanHTML(html)
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

  // Description — grab text from OPIS PRODUKTU section
  p.description = ''
  // Find the OPIS PRODUKTU header position and grab a large chunk after it
  const opisIdx = html.search(/OPIS\s+PRODUKTU/i)
  if (opisIdx > -1) {
    // Grab up to 10000 chars after OPIS PRODUKTU, stop at PODOBNY SPRZET or rent_like section
    const afterOpis = html.substring(opisIdx, opisIdx + 10000)
    const endIdx = afterOpis.search(/PODOBNY\s+SPRZ|class="[^"]*rent_like|class="[^"]*product_rent__header(?!.*OPIS)/i)
    const section = endIdx > 0 ? afterOpis.substring(0, endIdx) : afterOpis

    const paragraphs: string[] = []

    // Method 1: div.ewa-rteLine elements (inside opis_ul_fix or anywhere in OPIS section)
    const ewaRe = /<div[^>]*class="[^"]*ewa-rteLine[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
    let ewaMatch
    while ((ewaMatch = ewaRe.exec(section)) !== null) {
      const txt = ewaMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
      if (txt.length > 0 && !txt.includes('{') && !txt.includes('background-image')) {
        paragraphs.push(txt)
      }
    }

    // Method 2: also grab <p> tags in the section (some products may use <p> instead)
    if (paragraphs.length === 0) {
      const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi
      let pMatch
      while ((pMatch = pRe.exec(section)) !== null) {
        const txt = pMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
        if (txt.length > 3 && !txt.includes('{') && !txt.includes('background-image') && !/OPIS\s+PRODUKTU/i.test(txt)) {
          paragraphs.push(txt)
        }
      }
    }

    // Method 3: fallback — grab ALL text content from divs in the section (strip markup)
    if (paragraphs.length === 0) {
      const divRe = /<div[^>]*>([\s\S]*?)<\/div>/gi
      let divMatch
      while ((divMatch = divRe.exec(section)) !== null) {
        const txt = divMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
        if (txt.length > 10 && !txt.includes('{') && !txt.includes('background-image') && !/OPIS\s+PRODUKTU/i.test(txt)) {
          paragraphs.push(txt)
          break // take first meaningful div
        }
      }
    }

    if (paragraphs.length > 0) {
      p.description = paragraphs.join('\n\n')
    }
  }
  // Method 4 fallback: <p class="product_rent__text">
  if (!p.description) {
    const descM = html.match(/<(?:p|div|span)[^>]*class="[^"]*product_rent__text[^"]*"[^>]*>([\s\S]*?)<\/(?:p|div|span)>/i)
    if (descM) {
      const txt = descM[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      if (txt.length > 5 && !txt.includes('{') && !txt.includes('background-image')) {
        p.description = txt
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
        const html = await fetchHTML(`/wyniki-wyszukiwania/?szukaj=${encodeURIComponent(q)}`)
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
