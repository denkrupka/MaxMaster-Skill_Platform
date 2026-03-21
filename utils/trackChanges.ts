// Track Changes utility for MaxMaster document signing
// Computes word-level diff between original and edited HTML, returns patches

export interface Patch {
  id: string
  type: 'insert' | 'delete' | 'equal'
  text: string
  author: string
  status: 'pending' | 'approved' | 'rejected'
}

// Strip HTML tags, normalize whitespace, split into words
function tokenize(html: string): string[] {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
  return text.split(' ').filter(t => t.length > 0)
}

// LCS dynamic programming table
function lcs(a: string[], b: string[]): number[][] {
  const m = a.length, n = b.length
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp
}

// Backtrack LCS to produce edit operations
function diffOps(origWords: string[], editWords: string[]): Array<{ type: 'insert' | 'delete' | 'equal'; text: string }> {
  const dp = lcs(origWords, editWords)
  let i = origWords.length, j = editWords.length
  const ops: Array<{ type: 'insert' | 'delete' | 'equal'; text: string }> = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origWords[i - 1] === editWords[j - 1]) {
      ops.unshift({ type: 'equal', text: origWords[i - 1] })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: 'insert', text: editWords[j - 1] })
      j--
    } else {
      ops.unshift({ type: 'delete', text: origWords[i - 1] })
      i--
    }
  }

  // Merge consecutive same-type ops
  const merged: typeof ops = []
  for (const op of ops) {
    if (merged.length > 0 && merged[merged.length - 1].type === op.type) {
      merged[merged.length - 1].text += ' ' + op.text
    } else {
      merged.push({ ...op })
    }
  }
  return merged
}

// Compute patches (non-equal ops) from original vs edited HTML
export function computeDiffPatches(originalHtml: string, editedHtml: string, author: string): Patch[] {
  const origWords = tokenize(originalHtml)
  const editWords = tokenize(editedHtml)
  const merged = diffOps(origWords, editWords)

  const patches: Patch[] = []
  let idx = 0
  for (const op of merged) {
    if (op.type !== 'equal') {
      patches.push({
        id: `patch-${Date.now()}-${idx++}`,
        type: op.type,
        text: op.text,
        author,
        status: 'pending',
      })
    }
  }
  return patches
}

// Render document with inline <ins>/<del> annotations (Word-style track changes)
export function renderWithTrackChanges(
  originalHtml: string,
  editedHtml: string,
  _patches: Patch[] | null,
  author: string
): string {
  const origWords = tokenize(originalHtml)
  const editWords = tokenize(editedHtml)
  const merged = diffOps(origWords, editWords)

  let html = ''
  for (const op of merged) {
    if (op.type === 'equal') {
      html += op.text + ' '
    } else if (op.type === 'insert') {
      html += `<ins style="background:#d4edda;text-decoration:underline;color:#155724;padding:1px 2px;border-radius:2px" title="Dodano przez ${author}">${op.text}</ins> `
    } else if (op.type === 'delete') {
      html += `<del style="background:#f8d7da;text-decoration:line-through;color:#721c24;padding:1px 2px;border-radius:2px" title="Usunięto przez ${author}">${op.text}</del> `
    }
  }

  return `<div class="track-changes-view">${html}</div>`
}

// Apply approved patches to produce final document
export function applyApprovedPatches(originalHtml: string, editedHtml: string, patches: Patch[]): string {
  if (!patches || patches.length === 0) return editedHtml
  const allApproved = patches.every(p => p.status === 'approved')
  const allRejected = patches.every(p => p.status === 'rejected')
  if (allApproved) return editedHtml
  if (allRejected) return originalHtml
  // Partial: majority wins (simplified)
  const approved = patches.filter(p => p.status === 'approved').length
  return approved > patches.length / 2 ? editedHtml : originalHtml
}
