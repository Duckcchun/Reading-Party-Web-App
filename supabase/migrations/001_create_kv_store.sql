-- KV Store 테이블 생성
-- Edge Function에서 songs, sentences 데이터를 JSON으로 저장합니다.

CREATE TABLE IF NOT EXISTS kv_store_a010eb27 (
  key TEXT PRIMARY KEY,
  value JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS 비활성화 (Edge Function이 service_role_key로 접근)
ALTER TABLE kv_store_a010eb27 ENABLE ROW LEVEL SECURITY;

-- service_role은 모든 작업 허용
CREATE POLICY "Service role full access" ON kv_store_a010eb27
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Realtime 활성화 (broadcast 채널용)
ALTER PUBLICATION supabase_realtime ADD TABLE kv_store_a010eb27;
