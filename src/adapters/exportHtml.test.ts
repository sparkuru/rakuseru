import { describe, expect, it } from 'vitest'

import type { SheetDocument } from '../model/document'
import { exportHtml } from './exportHtml'
import { importHtml } from './importHtml'

const document: SheetDocument = {
  version: 1,
  title: 'Procurement <report>',
  columns: [
    { id: 'item', title: 'Item', type: 'text', width: 220, wrap: true },
    { id: 'budget', title: 'Budget', type: 'money', align: 'right' },
    { id: 'link', title: 'Link', type: 'link' },
    { id: 'image', title: 'Image', type: 'image' },
  ],
  rows: [
    {
      id: 'row_1',
      height: 180,
      cells: {
        item: 'Desk <script>alert("no")</script>',
        budget: 1200,
        link: 'https://example.com/item?name=desk&ref=report',
        image: { kind: 'image', name: 'desk.png', mime: 'image/png', dataUrl: 'data:image/png;base64,AA==', fit: 'contain' },
      },
    },
  ],
}

describe('HTML export and import', () => {
  it('renders a self-contained semantic report with presentation metadata', () => {
    const html = exportHtml(document, new Date('2026-07-16T12:30:00Z'))

    expect(html).toContain('<!doctype html>')
    expect(html).toContain('<style>')
    expect(html).toContain('<h1>Procurement &lt;report&gt;</h1>')
    expect(html).toContain('<table>')
    expect(html).toContain('body { box-sizing: border-box; width: 85vw; margin: 0 auto; padding: 40px 24px; }')
    expect(html).toContain('table { width: 100%; border-collapse: collapse; }')
    expect(html).toContain('width: 220px')
    expect(html).toContain('white-space: pre-wrap')
    expect(html).toContain('height: 180px')
    expect(html).toContain('class="fit-contain"')
    expect(html).toContain('href="https://example.com/item?name=desk&amp;ref=report"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('href="#rakuseru-image-1-4"')
    expect(html).toContain('class="image-lightbox" id="rakuseru-image-1-4"')
    expect(html).toContain('.image-lightbox:target { display: grid; }')
  })

  it('escapes report markup and embeds a script-safe canonical payload', () => {
    const html = exportHtml(document)

    expect(html).toContain('Desk &lt;script&gt;alert(&quot;no&quot;)&lt;/script&gt;')
    expect(html).not.toContain('<script>alert("no")</script>')
    expect(html).toContain('id="rakuseru-document" type="application/json"')

    const payload = documentWithScriptTerminator()
    const payloadHtml = exportHtml(payload)
    expect(payloadHtml).not.toContain('</script><script>alert("no")</script>')
    expect(importHtml(payloadHtml)).toEqual(payload)
  })

  it('round-trips the complete canonical document', () => {
    expect(importHtml(exportHtml(document))).toEqual(document)
  })

  it('renders unsafe link values as text', () => {
    const unsafeDocument = { ...document, rows: [{ ...document.rows[0], cells: { ...document.rows[0].cells, link: 'javascript:alert(1)' } }] }

    expect(exportHtml(unsafeDocument)).not.toContain('href="javascript:alert(1)"')
  })

  it.each([
    ['ordinary HTML', '<main>Not a Rakuseru export</main>', 'does not contain a Rakuseru document payload'],
    ['duplicate payloads', '<script id="rakuseru-document" type="application/json">{}</script><script id="rakuseru-document" type="application/json">{}</script>', 'contains multiple Rakuseru document payloads'],
    ['malformed payload', '<script id="rakuseru-document" type="application/json">{ no</script>', 'Invalid JSON:'],
    [
      'invalid canonical payload',
      '<script id="rakuseru-document" type="application/json">{"version":2,"title":"Sheet","columns":[{"id":"item","title":"Item","type":"text"}],"rows":[]}</script>',
      'Document version must be 1.',
    ],
  ])('rejects %s', (_label, content, message) => {
    expect(() => importHtml(content)).toThrow(message)
  })
})

function documentWithScriptTerminator(): SheetDocument {
  return {
    ...document,
    title: '</script><script>alert("no")</script>',
  }
}
