import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://tpqzzffltjtwefluvcpl.supabase.co'
const SUPABASE_KEY = 'sb_publishable_GKjrkNL2ZPuZeDvSbUg14g_NYkxoE9P'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
