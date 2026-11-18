import sanitizeHtml from 'sanitize-html'
export function safeTemplateHtml(html: string): string {
 return sanitizeHtml(html.slice(0, 20_000), {
  allowedTags: ['div','p','span','strong','b','em','i','u','br','hr','h1','h2','h3','h4','ul','ol','li','table','thead','tbody','tr','td','th','blockquote','a'],
  allowedAttributes: { '*': ['style'], a: ['href'] },
  allowedStyles: { '*': { color: [/^#[0-9a-f]{3,8}$/i, /^[a-z]+$/i], 'background-color': [/^#[0-9a-f]{3,8}$/i], 'font-size': [/^\d{1,2}px$/], 'font-weight': [/^(bold|normal|[1-9]00)$/], 'text-align': [/^(left|center|right)$/], padding: [/^[\d\spx]+$/], margin: [/^[\d\spx]+$/] } },
  transformTags: { a: () => ({ tagName: 'a', attribs: { href: '#' } }) },
  allowedSchemes: [], allowProtocolRelative: false,
 })
}
