// Supabase 클라이언트 싱글턴 인스턴스
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type ReviewImage = {
  url: string
  path: string
  material_type: string
  name: string
}

export type Review = {
  id: string
  hospital_name: string
  review_number: string
  approved_at: string
  expires_at: string
  material_types: string[]
  memo: string | null
  images: ReviewImage[]
  created_at: string
}

export type ReviewInsert = Omit<Review, 'id' | 'created_at'>
