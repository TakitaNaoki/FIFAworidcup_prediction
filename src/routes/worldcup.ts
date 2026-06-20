import { Hono } from 'hono'
import { Bindings } from '../types'

const wc = new Hono<{ Bindings: Bindings }>()

const BASE = 'https://worldcup26.ir'

// インメモリキャッシュ (TTL: 30秒)
const cache: Record<string, { data: any; ts: number }> = {}
const CACHE_TTL = 30000

async function fetchWCCached(path: string, timeoutMs = 15000): Promise<any> {
  const now = Date.now()
  if (cache[path] && now - cache[path].ts < CACHE_TTL) {
    return cache[path].data
  }
  const data = await fetchWC(path, timeoutMs)
  cache[path] = { data, ts: now }
  return data
}

// チームマップ (IDと日本語名)
const TEAM_JA: Record<string, string> = {
  '1': 'メキシコ', '2': '南アフリカ', '3': '韓国', '4': 'チェコ',
  '5': 'カナダ', '6': 'スイス', '7': 'カタール', '8': 'ボスニア・ヘルツェゴビナ',
  '9': 'ブラジル', '10': 'モロッコ', '11': 'ハイチ', '12': 'スコットランド',
  '13': 'アメリカ', '14': 'パラグアイ', '15': 'オーストラリア', '16': 'トルコ',
  '17': 'ドイツ', '18': 'エクアドル', '19': 'コートジボワール', '20': 'キュラソー',
  '21': 'オランダ', '22': '日本', '23': 'チュニジア', '24': 'スウェーデン',
  '25': 'ベルギー', '26': 'エジプト', '27': 'イラン', '28': 'ニュージーランド',
  '29': 'スペイン', '30': 'カーボベルデ', '31': 'サウジアラビア', '32': 'ウルグアイ',
  '33': 'フランス', '34': 'セネガル', '35': 'ノルウェー', '36': 'イラク',
  '37': 'アルゼンチン', '38': 'アルジェリア', '39': 'オーストリア', '40': 'ヨルダン',
  '41': 'ポルトガル', '42': 'コロンビア', '43': 'ウズベキスタン', '44': 'コンゴ民主共和国',
  '45': 'イングランド', '46': 'クロアチア', '47': 'ガーナ', '48': 'パナマ',
}

// タイムアウト付きfetch
async function fetchWC(path: string, timeoutMs = 20000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) throw new Error(`WC API error: ${res.status}`)
    return res.json()
  } catch (e) {
    clearTimeout(timer)
    throw e
  }
}

// 日本語名付きチームマップ生成ユーティリティ
function buildTeamMap(teams: any[]): Record<string, any> {
  const map: Record<string, any> = {}
  for (const t of teams) {
    map[t.id] = { ...t, name_ja: TEAM_JA[t.id] || t.name_en }
  }
  return map
}

// 全チーム
wc.get('/teams', async (c) => {
  try {
    const data: any = await fetchWCCached('/get/teams')
    const teams = (data.teams || []).map((t: any) => ({
      ...t,
      name_ja: TEAM_JA[t.id] || t.name_en,
    }))
    return c.json({ success: true, teams })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 502)
  }
})

// グループ順位表のみ (試合なし → 速い)
wc.get('/standings', async (c) => {
  try {
    const [groupsData, teamsData] = await Promise.all([
      fetchWCCached('/get/groups'),
      fetchWCCached('/get/teams'),
    ])
    const teamsMap = buildTeamMap(teamsData.teams || [])
    const groups = (groupsData.groups || []).map((g: any) => {
      const teamsInGroup = (g.teams || [])
        .map((t: any) => ({
          ...t,
          team: teamsMap[t.team_id] || null,
          name_ja: teamsMap[t.team_id]?.name_ja || '不明',
          name_en: teamsMap[t.team_id]?.name_en || '不明',
          flag: teamsMap[t.team_id]?.flag || '',
          fifa_code: teamsMap[t.team_id]?.fifa_code || '',
        }))
        .sort((a: any, b: any) => {
          const ptsDiff = parseInt(b.pts) - parseInt(a.pts)
          if (ptsDiff !== 0) return ptsDiff
          return parseInt(b.gd || 0) - parseInt(a.gd || 0)
        })
      return { group: g.name, teams: teamsInGroup }
    }).sort((a: any, b: any) => a.group.localeCompare(b.group))

    return c.json({ success: true, groups })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 502)
  }
})

// 試合一覧 (チーム名付き・キャッシュ付き)
wc.get('/matches', async (c) => {
  try {
    const [gamesData, teamsData] = await Promise.all([
      fetchWCCached('/get/games', 15000),
      fetchWCCached('/get/teams', 10000),
    ])
    const teamsMap = buildTeamMap(teamsData.teams || [])
    const matches = (gamesData.games || []).map((g: any) => ({
      id: g.id,
      group: g.group,
      type: g.type,
      matchday: g.matchday,
      local_date: g.local_date,
      finished: g.finished === 'TRUE',
      time_elapsed: g.time_elapsed,
      home_team_id: g.home_team_id,
      away_team_id: g.away_team_id,
      home_team: teamsMap[g.home_team_id] || null,
      away_team: teamsMap[g.away_team_id] || null,
      home_team_label: g.home_team_label || null,
      away_team_label: g.away_team_label || null,
      home_score: g.home_score,
      away_score: g.away_score,
      home_scorers: g.home_scorers,
      away_scorers: g.away_scorers,
    }))
    return c.json({ success: true, matches })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 502)
  }
})

export default wc
