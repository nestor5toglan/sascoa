export type SectorNode = { id: string; name: string; parent_id?: string | null }
export function descendantIds(nodes: SectorNode[], root: string): Set<string> {
  const children = new Map<string, string[]>()
  for (const node of nodes)
    if (node.parent_id) {
      const list = children.get(node.parent_id) ?? []
      list.push(node.id)
      children.set(node.parent_id, list)
    }
  const result = new Set<string>(),
    pending = [root]
  while (pending.length) {
    const id = pending.pop()!
    if (result.has(id)) continue
    result.add(id)
    pending.push(...(children.get(id) ?? []))
  }
  return result
}
// Parcours itératif : aucune limite artificielle de profondeur, ni récursion JS.
export function sectorTree<T extends SectorNode>(
  nodes: T[],
): (T & { label: string; depth: number })[] {
  const known = new Set(nodes.map((n) => n.id)),
    children = new Map<string, T[]>()
  for (const node of nodes) {
    const key = node.parent_id && known.has(node.parent_id) ? node.parent_id : ''
    const list = children.get(key) ?? []
    list.push(node)
    children.set(key, list)
  }
  const sort = (a: T, b: T) => a.name.localeCompare(b.name, 'fr') || a.id.localeCompare(b.id)
  for (const list of children.values()) list.sort(sort)
  const output: (T & { label: string; depth: number })[] = [],
    visited = new Set<string>()
  const walk = (roots: T[]) => {
    const pending = roots
      .slice()
      .reverse()
      .map((node) => ({ node, path: '' as string, depth: 0 }))
    while (pending.length) {
      const { node, path, depth } = pending.pop()!
      if (visited.has(node.id)) continue
      visited.add(node.id)
      const label = path ? `${path} › ${node.name}` : node.name
      output.push({ ...node, label, depth })
      for (const child of [...(children.get(node.id) ?? [])].reverse())
        pending.push({ node: child, path: label, depth: depth + 1 })
    }
  }
  walk(children.get('') ?? [])
  // Une donnée importée incohérente ne fait ni boucler ni disparaître une option.
  walk([...nodes].sort(sort).filter((node) => !visited.has(node.id)))
  return output
}
