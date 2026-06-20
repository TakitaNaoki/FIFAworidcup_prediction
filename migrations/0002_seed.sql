-- 2026 FIFA ワールドカップ 48チーム シードデータ
-- グループ A
INSERT OR IGNORE INTO countries (name, name_ja, code, group_name, flag_emoji) VALUES
  ('USA', 'アメリカ', 'USA', 'A', '🇺🇸'),
  ('Panama', 'パナマ', 'PAN', 'A', '🇵🇦'),
  ('Honduras', 'ホンジュラス', 'HON', 'A', '🇭🇳'),
  ('Morocco', 'モロッコ', 'MAR', 'A', '🇲🇦');

-- グループ B
INSERT OR IGNORE INTO countries (name, name_ja, code, group_name, flag_emoji) VALUES
  ('Spain', 'スペイン', 'ESP', 'B', '🇪🇸'),
  ('Croatia', 'クロアチア', 'CRO', 'B', '🇭🇷'),
  ('Italy', 'イタリア', 'ITA', 'B', '🇮🇹') -- Italy missed but placeholder; replace as needed
  ;

-- グループ C
INSERT OR IGNORE INTO countries (name, name_ja, code, group_name, flag_emoji) VALUES
  ('Argentina', 'アルゼンチン', 'ARG', 'C', '🇦🇷'),
  ('Chile', 'チリ', 'CHI', 'C', '🇨🇱'),
  ('Peru', 'ペルー', 'PER', 'C', '🇵🇪'),
  ('Canada', 'カナダ', 'CAN', 'C', '🇨🇦');

-- グループ D
INSERT OR IGNORE INTO countries (name, name_ja, code, group_name, flag_emoji) VALUES
  ('France', 'フランス', 'FRA', 'D', '🇫🇷'),
  ('Belgium', 'ベルギー', 'BEL', 'D', '🇧🇪'),
  ('Germany', 'ドイツ', 'GER', 'D', '🇩🇪'),
  ('Ivory Coast', 'コートジボワール', 'CIV', 'D', '🇨🇮');

-- グループ E
INSERT OR IGNORE INTO countries (name, name_ja, code, group_name, flag_emoji) VALUES
  ('Brazil', 'ブラジル', 'BRA', 'E', '🇧🇷'),
  ('Colombia', 'コロンビア', 'COL', 'E', '🇨🇴'),
  ('Paraguay', 'パラグアイ', 'PAR', 'E', '🇵🇾'),
  ('Ecuador', 'エクアドル', 'ECU', 'E', '🇪🇨');

-- グループ F
INSERT OR IGNORE INTO countries (name, name_ja, code, group_name, flag_emoji) VALUES
  ('England', 'イングランド', 'ENG', 'F', '🏴󠁧󠁢󠁥󠁮󠁧󠁿'),
  ('Netherlands', 'オランダ', 'NED', 'F', '🇳🇱'),
  ('Senegal', 'セネガル', 'SEN', 'F', '🇸🇳'),
  ('South Africa', '南アフリカ', 'RSA', 'F', '🇿🇦');

-- グループ G
INSERT OR IGNORE INTO countries (name, name_ja, code, group_name, flag_emoji) VALUES
  ('Mexico', 'メキシコ', 'MEX', 'G', '🇲🇽'),
  ('Venezuela', 'ベネズエラ', 'VEN', 'G', '🇻🇪'),
  ('Haiti', 'ハイチ', 'HAI', 'G', '🇭🇹'),
  ('DR Congo', 'コンゴ民主共和国', 'COD', 'G', '🇨🇩');

-- グループ H
INSERT OR IGNORE INTO countries (name, name_ja, code, group_name, flag_emoji) VALUES
  ('Portugal', 'ポルトガル', 'POR', 'H', '🇵🇹'),
  ('Turkey', 'トルコ', 'TUR', 'H', '🇹🇷'),
  ('Czech Republic', 'チェコ', 'CZE', 'H', '🇨🇿'),
  ('Algeria', 'アルジェリア', 'ALG', 'H', '🇩🇿');

-- グループ I
INSERT OR IGNORE INTO countries (name, name_ja, code, group_name, flag_emoji) VALUES
  ('Japan', '日本', 'JPN', 'I', '🇯🇵'),
  ('Australia', 'オーストラリア', 'AUS', 'I', '🇦🇺'),
  ('Saudi Arabia', 'サウジアラビア', 'KSA', 'I', '🇸🇦'),
  ('Uzbekistan', 'ウズベキスタン', 'UZB', 'I', '🇺🇿');

-- グループ J
INSERT OR IGNORE INTO countries (name, name_ja, code, group_name, flag_emoji) VALUES
  ('South Korea', '韓国', 'KOR', 'J', '🇰🇷'),
  ('Iran', 'イラン', 'IRN', 'J', '🇮🇷'),
  ('Iraq', 'イラク', 'IRQ', 'J', '🇮🇶'),
  ('Jordan', 'ヨルダン', 'JOR', 'J', '🇯🇴');

-- グループ K
INSERT OR IGNORE INTO countries (name, name_ja, code, group_name, flag_emoji) VALUES
  ('Switzerland', 'スイス', 'SUI', 'K', '🇨🇭'),
  ('Austria', 'オーストリア', 'AUT', 'K', '🇦🇹'),
  ('Bosnia Herzegovina', 'ボスニア・ヘルツェゴビナ', 'BIH', 'K', '🇧🇦'),
  ('Egypt', 'エジプト', 'EGY', 'K', '🇪🇬');

-- グループ L
INSERT OR IGNORE INTO countries (name, name_ja, code, group_name, flag_emoji) VALUES
  ('Uruguay', 'ウルグアイ', 'URU', 'L', '🇺🇾'),
  ('Norway', 'ノルウェー', 'NOR', 'L', '🇳🇴'),
  ('Scotland', 'スコットランド', 'SCO', 'L', '🏴󠁧󠁢󠁳󠁣󠁴󠁿'),
  ('Sweden', 'スウェーデン', 'SWE', 'L', '🇸🇪');

-- グループ A (続き)
INSERT OR IGNORE INTO countries (name, name_ja, code, group_name, flag_emoji) VALUES
  ('Qatar', 'カタール', 'QAT', 'A', '🇶🇦');

-- 追加チーム
INSERT OR IGNORE INTO countries (name, name_ja, code, group_name, flag_emoji) VALUES
  ('Tunisia', 'チュニジア', 'TUN', 'B', '🇹🇳'),
  ('Cape Verde', 'カーボベルデ', 'CPV', 'C', '🇨🇻'),
  ('New Zealand', 'ニュージーランド', 'NZL', 'D', '🇳🇿'),
  ('Curacao', 'キュラソー', 'CUW', 'E', '🇨🇼');

-- デフォルト管理者 (パスワード: admin123)
INSERT OR IGNORE INTO admins (username, password_hash) VALUES
  ('admin', 'admin123');
