export interface PagedResult<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}
