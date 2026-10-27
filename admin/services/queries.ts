export interface ListOptions<T> {
  page: number
  pageSize: number
  search?: string
  sortBy?: keyof T
  descending?: boolean
}

export function queryList<T extends object>(items: T[], options: ListOptions<T>) {
  const search = options.search?.trim().toLowerCase()
  const filtered = search
    ? items.filter((item) => Object.values(item).some((value) => String(value).toLowerCase().includes(search)))
    : [...items]
  if (options.sortBy) {
    const key = options.sortBy
    filtered.sort((a, b) => String(a[key]).localeCompare(String(b[key]), undefined, { numeric: true }) * (options.descending ? -1 : 1))
  }
  const start = Math.max(0, options.page - 1) * options.pageSize
  return { items: filtered.slice(start, start + options.pageSize), total: filtered.length }
}

export function infiniteWindow<T>(items: T[], cursor: number, limit: number) {
  const start = Math.max(0, cursor)
  const next = items.slice(start, start + limit)
  const nextCursor = start + next.length
  return { items: next, nextCursor: nextCursor < items.length ? nextCursor : null }
}
