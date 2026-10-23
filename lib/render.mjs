// Renders payload templates (*.tmpl). Two forms:
//   {{name}}          inline value
//   # {{name}}        on a line of its own: replaced by a block of lines, each indented like the marker
// An unknown name is an error, so a template never ships with a placeholder left in it.
export function render(text, vars) {
  const missing = new Set()
  const value = (name) => {
    if (!(name in vars)) { missing.add(name); return '' }
    return vars[name]
  }
  let out = text.replace(/^([ \t]*)# \{\{(\w+)\}\}[ \t]*$/gm, (_, indent, name) => {
    const v = value(name)
    const lines = Array.isArray(v) ? v : String(v).split('\n')
    return lines.filter((l) => l !== '').map((l) => indent + l).join('\n')
  })
  out = out.replace(/\{\{(\w+)\}\}/g, (_, name) => String(value(name)))
  if (missing.size) throw new Error(`template needs ${[...missing].join(', ')}`)
  // a block that rendered empty leaves an empty line; drop runs of them inside YAML step lists
  return out.replace(/\n{3,}/g, '\n\n')
}
