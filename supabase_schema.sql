-- EXECUTE ESTE SQL NO SUPABASE: SQL EDITOR -> NEW QUERY -> RUN

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT DEFAULT 'BATALHA POPULAR',
  team_a_name TEXT DEFAULT 'Lula',
  team_a_photo TEXT DEFAULT 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=400&h=400&fit=crop',
  team_a_color TEXT DEFAULT '#dc2626',
  team_a_score INT DEFAULT 751,
  team_b_name TEXT DEFAULT 'Bolsonaro',
  team_b_photo TEXT DEFAULT 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=400&h=400&fit=crop',
  team_b_color TEXT DEFAULT '#2563eb',
  team_b_score INT DEFAULT 1070,
  status TEXT DEFAULT 'VOTING',
  multiplier INT DEFAULT 1,
  rule_team_a TEXT DEFAULT '13',
  rule_team_b TEXT DEFAULT '22',
  current_leader TEXT DEFAULT 'B',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gift_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gift_id TEXT UNIQUE NOT NULL,
  gift_name TEXT NOT NULL,
  point_value INT DEFAULT 1,
  icon TEXT DEFAULT '🎁',
  target_team TEXT DEFAULT 'A'
);

CREATE TABLE IF NOT EXISTS public.vote_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id TEXT,
  username TEXT NOT NULL,
  type TEXT NOT NULL,
  payload TEXT,
  points INT DEFAULT 1,
  team TEXT DEFAULT 'A',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.donors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE NOT NULL,
  avatar TEXT,
  total_points INT DEFAULT 0,
  total_gifts INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vote_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on matches" ON public.matches;
CREATE POLICY "Allow public read on matches" ON public.matches FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public update on matches" ON public.matches;
CREATE POLICY "Allow public update on matches" ON public.matches FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public insert on matches" ON public.matches;
CREATE POLICY "Allow public insert on matches" ON public.matches FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read on gift_rules" ON public.gift_rules;
CREATE POLICY "Allow public read on gift_rules" ON public.gift_rules FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public write on gift_rules" ON public.gift_rules;
CREATE POLICY "Allow public write on gift_rules" ON public.gift_rules FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public read on vote_logs" ON public.vote_logs;
CREATE POLICY "Allow public read on vote_logs" ON public.vote_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert on vote_logs" ON public.vote_logs;
CREATE POLICY "Allow public insert on vote_logs" ON public.vote_logs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read on donors" ON public.donors;
CREATE POLICY "Allow public read on donors" ON public.donors FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public write on donors" ON public.donors;
CREATE POLICY "Allow public write on donors" ON public.donors FOR ALL USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gift_rules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vote_logs;

INSERT INTO public.matches (id, title, team_a_name, team_b_name, team_a_score, team_b_score)
VALUES ('00000000-0000-0000-0000-000000000001', 'BATALHA POPULAR', 'Lula', 'Bolsonaro', 751, 1070)
ON CONFLICT (id) DO NOTHING;

-- SEED: 3 Presentes para Lula (Time A) + 3 Presentes para Bolsonaro (Time B)
INSERT INTO public.gift_rules (gift_id, gift_name, point_value, icon, target_team) VALUES
('football', 'Bola', 1, '⚽', 'A'),
('panda', 'Panda', 10, '🐼', 'A'),
('heart', 'Coração', 20, '❤️', 'A'),
('rose', 'Rosa', 1, '🌹', 'B'),
('fire', 'Fogo', 10, '🔥', 'B'),
('gamepad', 'Controle', 20, '🎮', 'B')
ON CONFLICT (gift_id) DO NOTHING;
