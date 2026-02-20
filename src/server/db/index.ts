import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Next.js 개발 환경에서 HMR로 인한 커넥션 중복 방지
const globalForDb = globalThis as unknown as {
  client: postgres.Sql | undefined
}

const client =
  globalForDb.client ??
  postgres(process.env.DATABASE_URL!, {
    prepare: false, // Supabase Transaction Pooler 사용 시 필요
  })

if (process.env.NODE_ENV !== 'production') {
  globalForDb.client = client
}

export const db = drizzle(client, { schema })
