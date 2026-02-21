import { createClient } from '@supabase/supabase-js'

/**
 * Service Role 클라이언트 - RLS를 우회하여 서버 사이드에서만 사용
 * 클라이언트 컴포넌트에 절대 노출 금지
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
