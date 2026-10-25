import type { NextRequest } from 'next/server'
import { proxy, config } from './proxy'

export async function middleware(req: NextRequest) {
  return proxy(req)
}

export { config }
