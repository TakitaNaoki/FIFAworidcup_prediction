// worldcup26.ir へのプロキシサーバー (Node.js, port 3001)
import http from 'http'
import https from 'https'

const PORT = 3001
const BASE = 'https://worldcup26.ir'
const CACHE = new Map()
const TTL = 30000

function fetchExternal(path) {
  return new Promise((resolve, reject) => {
    const url = BASE + path
    https.get(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(body)) }
        catch (e) { reject(new Error('parse error: ' + e.message)) }
      })
    }).on('error', reject)
  })
}

async function getCached(path) {
  const now = Date.now()
  if (CACHE.has(path) && now - CACHE.get(path).ts < TTL) {
    return CACHE.get(path).data
  }
  const data = await fetchExternal(path)
  CACHE.set(path, { data, ts: now })
  return data
}

const TEAM_JA = {
  '1':'メキシコ','2':'南アフリカ','3':'韓国','4':'チェコ',
  '5':'カナダ','6':'スイス','7':'カタール','8':'ボスニア・ヘルツェゴビナ',
  '9':'ブラジル','10':'モロッコ','11':'ハイチ','12':'スコットランド',
  '13':'アメリカ','14':'パラグアイ','15':'オーストラリア','16':'トルコ',
  '17':'ドイツ','18':'エクアドル','19':'コートジボワール','20':'キュラソー',
  '21':'オランダ','22':'日本','23':'チュニジア','24':'スウェーデン',
  '25':'ベルギー','26':'エジプト','27':'イラン','28':'ニュージーランド',
  '29':'スペイン','30':'カーボベルデ','31':'サウジアラビア','32':'ウルグアイ',
  '33':'フランス','34':'セネガル','35':'ノルウェー','36':'イラク',
  '37':'アルゼンチン','38':'アルジェリア','39':'オーストリア','40':'ヨルダン',
  '41':'ポルトガル','42':'コロンビア','43':'ウズベキスタン','44':'コンゴ民主共和国',
  '45':'イングランド','46':'クロアチア','47':'ガーナ','48':'パナマ'
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  const url = new URL(req.url, 'http://localhost')
  const path = url.pathname

  try {
    if (path === '/proxy/wc/teams') {
      const data = await getCached('/get/teams')
      const teams = (data.teams || []).map(t => ({ ...t, name_ja: TEAM_JA[t.id] || t.name_en }))
      res.end(JSON.stringify({ success: true, teams }))

    } else if (path === '/proxy/wc/standings') {
      const [groupsData, teamsData] = await Promise.all([
        getCached('/get/groups'),
        getCached('/get/teams')
      ])
      const teamsMap = {}
      for (const t of (teamsData.teams || [])) {
        teamsMap[t.id] = { ...t, name_ja: TEAM_JA[t.id] || t.name_en }
      }
      const groups = (groupsData.groups || []).map(g => {
        const teams = (g.teams || [])
          .map(t => ({ ...t, team: teamsMap[t.team_id] || null, name_ja: teamsMap[t.team_id]?.name_ja || '不明', flag: teamsMap[t.team_id]?.flag || '' }))
          .sort((a, b) => { const d = parseInt(b.pts) - parseInt(a.pts); return d !== 0 ? d : parseInt(b.gd||0) - parseInt(a.gd||0) })
        return { group: g.name, teams }
      }).sort((a, b) => a.group.localeCompare(b.group))
      res.end(JSON.stringify({ success: true, groups }))

    } else if (path === '/proxy/wc/matches') {
      const [gamesData, teamsData] = await Promise.all([
        getCached('/get/games'),
        getCached('/get/teams')
      ])
      const teamsMap = {}
      for (const t of (teamsData.teams || [])) {
        teamsMap[t.id] = { ...t, name_ja: TEAM_JA[t.id] || t.name_en }
      }
      const matches = (gamesData.games || []).map(g => ({
        id: g.id, group: g.group, type: g.type, matchday: g.matchday,
        local_date: g.local_date, finished: g.finished === 'TRUE',
        time_elapsed: g.time_elapsed,
        home_team_id: g.home_team_id, away_team_id: g.away_team_id,
        home_team: teamsMap[g.home_team_id] || null,
        away_team: teamsMap[g.away_team_id] || null,
        home_team_label: g.home_team_label || null, away_team_label: g.away_team_label || null,
        home_score: g.home_score, away_score: g.away_score,
        home_scorers: g.home_scorers, away_scorers: g.away_scorers,
      }))
      res.end(JSON.stringify({ success: true, matches }))

    } else {
      res.statusCode = 404
      res.end(JSON.stringify({ success: false, error: 'not found' }))
    }
  } catch (e) {
    res.statusCode = 502
    res.end(JSON.stringify({ success: false, error: e.message }))
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`WC proxy server running on port ${PORT}`)
})
