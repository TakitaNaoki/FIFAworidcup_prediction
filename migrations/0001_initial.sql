-- 参加者テーブル
CREATE TABLE IF NOT EXISTS participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  initial_points INTEGER NOT NULL DEFAULT 100,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 国テーブル (48チーム)
CREATE TABLE IF NOT EXISTS countries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_ja TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  group_name TEXT,
  flag_emoji TEXT,
  eliminated INTEGER NOT NULL DEFAULT 0,
  eliminated_round TEXT,
  is_winner INTEGER NOT NULL DEFAULT 0
);

-- 賭けテーブル (参加者が各国に配分したポイント)
CREATE TABLE IF NOT EXISTS bets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_id INTEGER NOT NULL,
  country_id INTEGER NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (participant_id) REFERENCES participants(id),
  FOREIGN KEY (country_id) REFERENCES countries(id),
  UNIQUE(participant_id, country_id)
);

-- 管理者テーブル
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Google Sheets 同期ログ
CREATE TABLE IF NOT EXISTS sync_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  rows_processed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success',
  message TEXT
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_bets_participant ON bets(participant_id);
CREATE INDEX IF NOT EXISTS idx_bets_country ON bets(country_id);
