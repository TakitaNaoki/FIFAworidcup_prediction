import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { Bindings } from './types'
import countriesRoute from './routes/countries'
import participantsRoute from './routes/participants'
import betsRoute from './routes/bets'
import adminRoute from './routes/admin'
import wcRoute from './routes/worldcup'

const app = new Hono<{ Bindings: Bindings }>()

// CORS設定
app.use('/api/*', cors())

// 静的ファイル配信
app.use('/static/*', serveStatic({ root: './public' }))

// API ルーティング
app.route('/api/countries', countriesRoute)
app.route('/api/participants', participantsRoute)
app.route('/api/bets', betsRoute)
app.route('/api/admin', adminRoute)
app.route('/api/wc', wcRoute)

// ヘルスチェック
app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

// メインページ
app.get('/', (c) => {
  return c.html(mainPageHtml())
})

// 管理者ページ
app.get('/admin', (c) => {
  return c.html(adminPageHtml())
})

// フォーム入力ページ
app.get('/bet', (c) => {
  return c.html(betPageHtml())
})

// W杯情報ページ (グループ + トーナメント)
app.get('/worldcup', (c) => {
  return c.html(worldcupPageHtml())
})

function mainPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🏆 WC2026 予想ゲーム</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    .trophy-bg { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); }
    .card-hover { transition: all 0.3s ease; }
    .card-hover:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.3); }
    .odds-badge { background: linear-gradient(135deg, #f6d365 0%, #fda085 100%); }
    .winner-glow { animation: glow 2s ease-in-out infinite alternate; box-shadow: 0 0 20px #ffd700; }
    @keyframes glow { from { box-shadow: 0 0 10px #ffd700; } to { box-shadow: 0 0 30px #ffd700, 0 0 40px #ffaa00; } }
    .eliminated-card { opacity: 0.4; filter: grayscale(80%); }
    .rank-1 { background: linear-gradient(135deg, #ffd700, #ffaa00); }
    .rank-2 { background: linear-gradient(135deg, #c0c0c0, #a0a0a0); }
    .rank-3 { background: linear-gradient(135deg, #cd7f32, #a0522d); }
  </style>
</head>
<body class="trophy-bg min-h-screen text-white">
  <!-- ヘッダー -->
  <header class="bg-black/30 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <span class="text-3xl">🏆</span>
        <div>
          <h1 class="text-xl font-bold text-yellow-400">WC2026 予想ゲーム</h1>
          <p class="text-xs text-gray-400">FIFA ワールドカップ 2026</p>
        </div>
      </div>
      <nav class="flex gap-2">
        <button onclick="showTab('ranking')" id="tab-ranking"
          class="tab-btn px-4 py-2 rounded-lg bg-yellow-500 text-black font-bold text-sm">
          <i class="fas fa-trophy mr-1"></i>ランキング
        </button>
        <button onclick="showTab('odds')" id="tab-odds"
          class="tab-btn px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20">
          <i class="fas fa-chart-bar mr-1"></i>オッズ
        </button>
        <a href="/worldcup" class="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700">
          <i class="fas fa-futbol mr-1"></i>W杯情報
        </a>
        <a href="/bet" class="px-4 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700">
          <i class="fas fa-edit mr-1"></i>予想入力
        </a>
      </nav>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-4 py-6">

    <!-- ランキングタブ -->
    <section id="panel-ranking">
      <div class="mb-6">
        <h2 class="text-2xl font-bold text-yellow-400 mb-1">
          <i class="fas fa-crown mr-2"></i>参加者ランキング
        </h2>
        <p class="text-gray-400 text-sm">優勝国確定後に最終ポイントが計算されます</p>
      </div>

      <div id="winner-banner" class="hidden mb-6 p-4 rounded-2xl bg-yellow-500/20 border border-yellow-500 winner-glow">
        <div class="flex items-center gap-3">
          <span class="text-4xl">🏆</span>
          <div>
            <p class="text-yellow-400 font-bold text-lg">優勝国決定！</p>
            <p id="winner-text" class="text-white text-2xl font-bold"></p>
          </div>
        </div>
      </div>

      <div id="ranking-list" class="space-y-3">
        <div class="text-center py-8 text-gray-400">
          <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
          <p>読み込み中...</p>
        </div>
      </div>
    </section>

    <!-- オッズタブ -->
    <section id="panel-odds" class="hidden">
      <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-2xl font-bold text-yellow-400 mb-1">
            <i class="fas fa-chart-line mr-2"></i>オッズ一覧
          </h2>
          <p class="text-gray-400 text-sm">全体の賭けポイントから自動計算 (パリミュチュエル方式)</p>
        </div>
        <div class="flex gap-2">
          <button onclick="filterOdds('all')" id="filter-all"
            class="filter-btn px-3 py-1 rounded-lg bg-yellow-500 text-black text-sm font-bold">全て</button>
          <button onclick="filterOdds('active')" id="filter-active"
            class="filter-btn px-3 py-1 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20">残存</button>
          <button onclick="filterOdds('eliminated')" id="filter-eliminated"
            class="filter-btn px-3 py-1 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20">敗退</button>
        </div>
      </div>

      <div id="total-bet-info" class="mb-4 p-4 rounded-xl bg-white/5 border border-white/10">
        <p class="text-gray-400 text-sm">総賭けポイント: <span id="total-bet-points" class="text-yellow-400 font-bold">-</span> pts</p>
      </div>

      <div id="odds-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        <div class="col-span-full text-center py-8 text-gray-400">
          <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
          <p>読み込み中...</p>
        </div>
      </div>
    </section>
  </main>

  <footer class="text-center py-6 text-gray-500 text-sm mt-8 border-t border-white/10">
    <p>WC2026 予想ゲーム | 研究室内ゲーム用</p>
    <p class="mt-1"><a href="/admin" class="text-gray-600 hover:text-gray-400 text-xs">管理者ページ</a></p>
  </footer>

  <script>
    let allOddsData = []
    let currentFilter = 'all'

    function showTab(tab) {
      document.getElementById('panel-ranking').classList.add('hidden')
      document.getElementById('panel-odds').classList.add('hidden')
      document.getElementById('panel-' + tab).classList.remove('hidden')
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.className = 'tab-btn px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20'
      })
      document.getElementById('tab-' + tab).className = 'tab-btn px-4 py-2 rounded-lg bg-yellow-500 text-black font-bold text-sm'
    }

    function filterOdds(type) {
      currentFilter = type
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.className = 'filter-btn px-3 py-1 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20'
      })
      document.getElementById('filter-' + type).className = 'filter-btn px-3 py-1 rounded-lg bg-yellow-500 text-black text-sm font-bold'
      renderOdds()
    }

    function renderOdds() {
      const grid = document.getElementById('odds-grid')
      let data = allOddsData

      if (currentFilter === 'active') data = data.filter(c => !c.eliminated)
      if (currentFilter === 'eliminated') data = data.filter(c => c.eliminated)

      if (data.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center py-8 text-gray-400">該当するチームがありません</div>'
        return
      }

      // オッズ昇順でソート (低いオッズ = 人気)
      data.sort((a, b) => {
        if (a.total_bet_points === 0 && b.total_bet_points === 0) return 0
        if (a.total_bet_points === 0) return 1
        if (b.total_bet_points === 0) return -1
        return a.odds - b.odds
      })

      grid.innerHTML = data.map((c, i) => {
        const isElim = c.eliminated
        const isWinner = c.is_winner
        const oddsDisplay = c.total_bet_points > 0 ? c.odds.toFixed(2) + 'x' : 'N/A'
        const barWidth = c.total_bet_points > 0
          ? Math.min(100, Math.round((c.total_bet_points / (allOddsData.reduce((m, x) => Math.max(m, x.total_bet_points), 1))) * 100))
          : 0

        return \`
          <div class="card-hover rounded-2xl p-4 border \${
            isWinner ? 'bg-yellow-500/20 border-yellow-500 winner-glow' :
            isElim ? 'bg-white/3 border-white/10 eliminated-card' :
            'bg-white/5 border-white/10'
          }">
            <div class="flex items-start justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="text-2xl">\${c.flag_emoji || '🏳️'}</span>
                <div>
                  <p class="font-bold text-sm">\${c.country_name_ja}</p>
                  <p class="text-xs text-gray-400">グループ \${c.group_name || '-'}</p>
                </div>
              </div>
              <div class="text-right">
                \${isWinner ? '<span class="text-yellow-400 text-lg">🏆</span>' :
                  isElim ? '<span class="text-red-400 text-xs px-2 py-0.5 bg-red-900/30 rounded">敗退</span>' :
                  \`<span class="odds-badge px-2 py-0.5 rounded text-black font-bold text-sm">\${oddsDisplay}</span>\`
                }
              </div>
            </div>
            <div class="mt-2">
              <div class="flex justify-between text-xs text-gray-400 mb-1">
                <span>賭けポイント</span>
                <span class="text-white font-bold">\${c.total_bet_points} pts</span>
              </div>
              <div class="w-full bg-white/10 rounded-full h-1.5">
                <div class="bg-yellow-400 h-1.5 rounded-full" style="width: \${barWidth}%"></div>
              </div>
            </div>
          </div>
        \`
      }).join('')
    }

    async function loadRanking() {
      try {
        const res = await fetch('/api/participants')
        const json = await res.json()

        if (json.winner_decided) {
          // 優勝国表示
          const countriesRes = await fetch('/api/countries')
          const countriesJson = await countriesRes.json()
          const winner = countriesJson.data.find(c => c.is_winner)
          if (winner) {
            document.getElementById('winner-banner').classList.remove('hidden')
            document.getElementById('winner-text').textContent =
              winner.flag_emoji + ' ' + winner.country_name_ja + ' (' + winner.country_name + ')'
          }
        }

        const list = document.getElementById('ranking-list')
        if (!json.data || json.data.length === 0) {
          list.innerHTML = '<div class="text-center py-12 text-gray-400"><i class="fas fa-users text-4xl mb-3 block"></i><p>まだ参加者がいません</p><p class="text-sm mt-1">Google Formsで予想を送信してください</p></div>'
          return
        }

        list.innerHTML = json.data.map(p => {
          const rankClass = p.rank === 1 ? 'rank-1' : p.rank === 2 ? 'rank-2' : p.rank === 3 ? 'rank-3' : 'bg-white/10'
          const rankEmoji = p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : \`#\${p.rank}\`
          const isPositive = p.net_gain > 0
          const isNegative = p.net_gain < 0

          return \`
            <div class="card-hover rounded-2xl p-4 border border-white/10 bg-white/5 flex flex-wrap items-center gap-4">
              <div class="\${rankClass} w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-black flex-shrink-0">
                \${rankEmoji}
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-bold text-lg truncate">\${p.name}</p>
                <p class="text-sm text-gray-400">賭けた: <span class="text-white">\${p.total_bet_points}pts</span> / 残り: <span class="text-white">\${p.remaining_points}pts</span></p>
              </div>
              <div class="text-right">
                <p class="text-2xl font-bold \${json.winner_decided ? (isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-white') : 'text-yellow-400'}">
                  \${p.current_points} pts
                </p>
                \${json.winner_decided && p.payout > 0 ? \`<p class="text-xs text-green-400">配当: +\${p.payout}pts</p>\` : ''}
                \${json.winner_decided ? \`<p class="text-xs \${isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-gray-400'}">\${isPositive ? '+' : ''}\${p.net_gain}pts\</p>\` : ''}
              </div>
            </div>
          \`
        }).join('')
      } catch (e) {
        document.getElementById('ranking-list').innerHTML =
          '<div class="text-center py-8 text-red-400">データの取得に失敗しました</div>'
      }
    }

    async function loadOdds() {
      try {
        const res = await fetch('/api/countries')
        const json = await res.json()
        allOddsData = json.data || []
        document.getElementById('total-bet-points').textContent = json.total_bet_points || 0
        renderOdds()
      } catch (e) {
        document.getElementById('odds-grid').innerHTML =
          '<div class="col-span-full text-center py-8 text-red-400">データの取得に失敗しました</div>'
      }
    }

    // 初期ロード
    loadRanking()
    loadOdds()

    // 30秒ごとに自動更新
    setInterval(() => { loadRanking(); loadOdds() }, 30000)
  </script>
</body>
</html>`
}

function betPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>⚽ 予想入力 | WC2026</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    .trophy-bg { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); }
    .country-card { cursor: pointer; transition: all 0.2s ease; }
    .country-card:hover { transform: translateY(-1px); }
    .country-card.selected { border-color: #f6d365 !important; background: rgba(246,211,101,0.1) !important; }
    input[type=range] { accent-color: #f6d365; }
    .slider-container { display: none; }
    .country-card.selected .slider-container { display: block; }
  </style>
</head>
<body class="trophy-bg min-h-screen text-white">
  <header class="bg-black/30 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
    <div class="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
      <a href="/" class="text-gray-400 hover:text-white"><i class="fas fa-arrow-left"></i></a>
      <div>
        <h1 class="text-xl font-bold text-yellow-400">⚽ 予想入力</h1>
        <p class="text-xs text-gray-400">優勝国を予想してポイントを配分しよう！</p>
      </div>
    </div>
  </header>

  <main class="max-w-4xl mx-auto px-4 py-6">
    <!-- 参加者名入力 -->
    <div class="mb-6 p-5 rounded-2xl bg-white/5 border border-white/10">
      <label class="block text-sm font-bold text-yellow-400 mb-2">
        <i class="fas fa-user mr-2"></i>あなたの名前
      </label>
      <input type="text" id="participant-name" placeholder="名前を入力"
        class="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400">
    </div>

    <!-- ポイント残高 -->
    <div class="mb-6 p-5 rounded-2xl bg-white/5 border border-yellow-500/30">
      <div class="flex justify-between items-center">
        <div>
          <p class="text-sm text-gray-400">使用可能ポイント</p>
          <p class="text-3xl font-bold text-yellow-400"><span id="remaining-pts">100</span> pts</p>
        </div>
        <div class="text-right">
          <p class="text-sm text-gray-400">配分済み</p>
          <p class="text-2xl font-bold text-white"><span id="used-pts">0</span> pts</p>
        </div>
      </div>
      <div class="mt-3 w-full bg-white/10 rounded-full h-3">
        <div id="pts-bar" class="bg-yellow-400 h-3 rounded-full transition-all" style="width: 0%"></div>
      </div>
    </div>

    <!-- 国一覧 -->
    <div class="mb-4 flex gap-2 flex-wrap">
      <span class="text-sm text-gray-400">グループでフィルタ:</span>
      <button onclick="filterGroup('all')" id="grp-all"
        class="grp-btn px-3 py-1 rounded-lg bg-yellow-500 text-black text-xs font-bold">全て</button>
    </div>

    <div id="countries-grid" class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
      <div class="col-span-full text-center py-8 text-gray-400">
        <i class="fas fa-spinner fa-spin text-xl"></i>
      </div>
    </div>

    <!-- 送信ボタン -->
    <div class="sticky bottom-4">
      <button onclick="submitBets()" id="submit-btn"
        class="w-full py-4 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all">
        <i class="fas fa-paper-plane mr-2"></i>予想を確定する
      </button>
    </div>
  </main>

  <script>
    let allCountries = []
    let betPoints = {}
    const MAX_POINTS = 100

    async function loadCountries() {
      const res = await fetch('/api/countries')
      const json = await res.json()
      allCountries = json.data || []

      // グループボタン生成
      const groups = [...new Set(allCountries.map(c => c.group_name).filter(Boolean))].sort()
      const grpContainer = document.querySelector('.flex.gap-2.flex-wrap')
      groups.forEach(g => {
        const btn = document.createElement('button')
        btn.id = 'grp-' + g
        btn.className = 'grp-btn px-3 py-1 rounded-lg bg-white/10 text-white text-xs hover:bg-white/20'
        btn.textContent = 'グループ ' + g
        btn.onclick = () => filterGroup(g)
        grpContainer.appendChild(btn)
      })

      renderCountries(allCountries)
    }

    function filterGroup(grp) {
      document.querySelectorAll('.grp-btn').forEach(b => {
        b.className = 'grp-btn px-3 py-1 rounded-lg bg-white/10 text-white text-xs hover:bg-white/20'
      })
      const activeBtn = document.getElementById('grp-' + grp)
      if (activeBtn) activeBtn.className = 'grp-btn px-3 py-1 rounded-lg bg-yellow-500 text-black text-xs font-bold'

      const filtered = grp === 'all' ? allCountries : allCountries.filter(c => c.group_name === grp)
      renderCountries(filtered)
    }

    function renderCountries(countries) {
      const grid = document.getElementById('countries-grid')
      grid.innerHTML = countries.map(c => {
        const pts = betPoints[c.country_id] || 0
        const isSelected = pts > 0
        return \`
          <div id="card-\${c.country_id}"
            class="country-card rounded-2xl p-4 border border-white/10 bg-white/5 \${isSelected ? 'selected' : ''}"
            onclick="toggleCountry(\${c.country_id})">
            <div class="flex items-center gap-3">
              <span class="text-3xl">\${c.flag_emoji || '🏳️'}</span>
              <div class="flex-1">
                <p class="font-bold">\${c.country_name_ja}</p>
                <p class="text-xs text-gray-400">グループ \${c.group_name || '-'} | オッズ: \${c.odds > 0 ? c.odds.toFixed(2) + 'x' : 'N/A'}</p>
              </div>
              <span class="text-yellow-400 font-bold text-lg">\${pts > 0 ? pts + 'pts' : ''}</span>
            </div>
            <div class="slider-container mt-3">
              <input type="range" min="0" max="100" value="\${pts}" id="slider-\${c.country_id}"
                oninput="updatePts(\${c.country_id}, this.value)"
                onclick="event.stopPropagation()"
                class="w-full">
              <div class="flex justify-between text-xs text-gray-400 mt-1">
                <span>0</span>
                <span id="pts-label-\${c.country_id}" class="text-yellow-400 font-bold">\${pts} pts</span>
                <span>100</span>
              </div>
            </div>
          </div>
        \`
      }).join('')
    }

    function toggleCountry(id) {
      const card = document.getElementById('card-' + id)
      if (!card) return

      if (card.classList.contains('selected')) {
        // 選択解除
        betPoints[id] = 0
        card.classList.remove('selected')
        updateTotals()
        const slider = document.getElementById('slider-' + id)
        if (slider) slider.value = 0
        const label = document.getElementById('pts-label-' + id)
        if (label) label.textContent = '0 pts'
        const ptBadge = card.querySelector('.text-yellow-400.font-bold.text-lg')
        if (ptBadge) ptBadge.textContent = ''
      } else {
        // 選択
        card.classList.add('selected')
        if (!betPoints[id]) {
          betPoints[id] = 10
          const slider = document.getElementById('slider-' + id)
          if (slider) slider.value = 10
          const label = document.getElementById('pts-label-' + id)
          if (label) label.textContent = '10 pts'
          const ptBadge = card.querySelector('.text-yellow-400.font-bold.text-lg')
          if (ptBadge) ptBadge.textContent = '10pts'
        }
        updateTotals()
      }
    }

    function updatePts(id, value) {
      const val = parseInt(value)
      betPoints[id] = val
      const label = document.getElementById('pts-label-' + id)
      if (label) label.textContent = val + ' pts'
      const card = document.getElementById('card-' + id)
      if (card) {
        const ptBadge = card.querySelector('.text-yellow-400.font-bold.text-lg')
        if (ptBadge) ptBadge.textContent = val > 0 ? val + 'pts' : ''
      }
      updateTotals()

      // 最大ポイント超過時に調整
      const total = Object.values(betPoints).reduce((s, v) => s + v, 0)
      if (total > MAX_POINTS) {
        const excess = total - MAX_POINTS
        betPoints[id] = Math.max(0, val - excess)
        const slider = document.getElementById('slider-' + id)
        if (slider) slider.value = betPoints[id]
        if (label) label.textContent = betPoints[id] + ' pts'
        updateTotals()
      }
    }

    function updateTotals() {
      const used = Object.values(betPoints).reduce((s, v) => s + v, 0)
      const remaining = MAX_POINTS - used
      document.getElementById('used-pts').textContent = used
      document.getElementById('remaining-pts').textContent = remaining
      document.getElementById('pts-bar').style.width = used + '%'
      document.getElementById('pts-bar').className =
        'h-3 rounded-full transition-all ' + (used > 100 ? 'bg-red-500' : used > 80 ? 'bg-orange-400' : 'bg-yellow-400')
    }

    async function submitBets() {
      const name = document.getElementById('participant-name').value.trim()
      if (!name) {
        alert('名前を入力してください')
        return
      }

      const bets = Object.entries(betPoints)
        .filter(([, pts]) => pts > 0)
        .map(([id, pts]) => ({ country_id: parseInt(id), points: pts }))

      if (bets.length === 0) {
        alert('少なくとも1カ国にポイントを配分してください')
        return
      }

      const total = bets.reduce((s, b) => s + b.points, 0)
      if (total > 100) {
        alert('合計ポイントが100を超えています: ' + total + 'pts')
        return
      }

      const btn = document.getElementById('submit-btn')
      btn.disabled = true
      btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>送信中...'

      try {
        const res = await fetch('/api/bets/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participant_name: name, bets })
        })
        const json = await res.json()

        if (json.success) {
          btn.innerHTML = '<i class="fas fa-check mr-2"></i>予想を確定しました！'
          btn.className = btn.className.replace('bg-green-600 hover:bg-green-700', 'bg-blue-600')
          setTimeout(() => { window.location.href = '/' }, 1500)
        } else {
          alert('エラー: ' + json.error)
          btn.disabled = false
          btn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>予想を確定する'
        }
      } catch (e) {
        alert('送信に失敗しました')
        btn.disabled = false
        btn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>予想を確定する'
      }
    }

    loadCountries()
  </script>
</body>
</html>`
}

function adminPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🔧 管理者 | WC2026</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    .trophy-bg { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); }
  </style>
</head>
<body class="trophy-bg min-h-screen text-white">
  <!-- 認証モーダル -->
  <div id="auth-modal" class="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
    <div class="bg-gray-900 border border-white/20 rounded-2xl p-8 w-full max-w-sm mx-4">
      <h2 class="text-xl font-bold text-yellow-400 mb-4 text-center">
        <i class="fas fa-lock mr-2"></i>管理者認証
      </h2>
      <input type="password" id="admin-password" placeholder="管理者パスワード"
        class="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white mb-4 focus:outline-none focus:border-yellow-400"
        onkeydown="if(event.key==='Enter') authenticate()">
      <button onclick="authenticate()"
        class="w-full py-3 rounded-xl bg-yellow-500 text-black font-bold hover:bg-yellow-400">
        ログイン
      </button>
      <p id="auth-error" class="text-red-400 text-sm mt-2 text-center hidden">パスワードが違います</p>
    </div>
  </div>

  <header class="bg-black/30 backdrop-blur-md border-b border-white/10">
    <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <a href="/" class="text-gray-400 hover:text-white"><i class="fas fa-arrow-left"></i></a>
        <h1 class="text-xl font-bold text-yellow-400">🔧 管理者パネル</h1>
      </div>
      <div id="admin-info" class="text-sm text-gray-400 hidden">
        <i class="fas fa-circle text-green-400 mr-1"></i>認証済み
      </div>
    </div>
  </header>

  <main class="max-w-6xl mx-auto px-4 py-6 space-y-6">

    <!-- サマリー -->
    <section id="summary-section" class="hidden">
      <div id="summary-cards" class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      </div>
    </section>

    <!-- Google Sheets 同期 -->
    <section id="sync-section" class="hidden p-5 rounded-2xl bg-white/5 border border-white/10">
      <h2 class="text-lg font-bold text-yellow-400 mb-1">
        <i class="fas fa-table mr-2"></i>Google Forms / Sheets 同期
      </h2>
      <p class="text-xs text-gray-400 mb-4">
        Google Forms の回答スプレッドシートから参加者の予想を一括インポートします.
        <a href="#sheets-guide" onclick="toggleGuide()" class="text-blue-400 underline ml-1">設定ガイドを見る</a>
      </p>

      <!-- 設定ガイド (折りたたみ) -->
      <div id="sheets-guide" class="hidden mb-4 p-4 rounded-xl bg-blue-900/20 border border-blue-500/30 text-xs text-gray-300 space-y-2">
        <p class="font-bold text-blue-300">📋 Google Formsフォームの作り方</p>
        <ol class="list-decimal list-inside space-y-1 text-gray-400">
          <li>Google Forms で新規フォームを作成</li>
          <li><strong class="text-white">「お名前」</strong> という名前の記述式質問を追加 (必須)</li>
          <li>各チーム名 (例: <strong class="text-white">日本, ブラジル, ...</strong>) を題名にした
              <strong class="text-white">「記述式」または「プルダウン」</strong>質問を追加
              → 参加者が配分ポイント (0〜100の整数) を入力</li>
          <li>回答 → <strong class="text-white">「スプレッドシートにリンク」</strong> でスプレッドシートを作成</li>
        </ol>
        <p class="font-bold text-blue-300 pt-1">🔑 Google Sheets API キーの取得</p>
        <ol class="list-decimal list-inside space-y-1 text-gray-400">
          <li><a href="https://console.cloud.google.com/" target="_blank" class="text-blue-400 underline">Google Cloud Console</a> でプロジェクト作成</li>
          <li>「APIとサービス」→「ライブラリ」→ Google Sheets API を有効化</li>
          <li>「認証情報」→「APIキーを作成」→ キーをコピー</li>
          <li>スプレッドシートを <strong class="text-white">「リンクを知っている全員が閲覧可能」</strong> に設定</li>
        </ol>
        <p class="font-bold text-blue-300 pt-1">🆔 Spreadsheet ID の確認</p>
        <p class="text-gray-400">スプレッドシートのURLの <code class="bg-black/30 px-1 rounded">docs.google.com/spreadsheets/d/<strong class="text-white">【ここ】</strong>/edit</code> の部分</p>
      </div>

      <div class="grid gap-3">
        <!-- スプレッドシートURL or ID -->
        <div>
          <label class="block text-xs text-gray-400 mb-1">スプレッドシートURL または ID <span class="text-red-400">*</span></label>
          <input type="text" id="spreadsheet-id"
            placeholder="https://docs.google.com/spreadsheets/d/XXXXXX/edit  または  XXXXXX"
            class="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
            oninput="extractSheetId(this)">
          <p id="sheet-id-display" class="text-xs text-green-400 mt-1 hidden"></p>
        </div>
        <!-- API Key -->
        <div>
          <label class="block text-xs text-gray-400 mb-1">Google Sheets API Key <span class="text-red-400">*</span></label>
          <input type="password" id="api-key" placeholder="AIza..."
            class="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-yellow-400">
        </div>
        <!-- シート名 (オプション) -->
        <div>
          <label class="block text-xs text-gray-400 mb-1">シート名 (省略時は最初のシートを使用)</label>
          <input type="text" id="sheet-name" placeholder="フォームの回答 1"
            class="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-yellow-400">
        </div>
        <!-- 上書きモード -->
        <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input type="checkbox" id="overwrite-mode" checked class="w-4 h-4 rounded accent-yellow-400">
          既存の参加者データを上書きする
        </label>
        <!-- アクションボタン -->
        <div class="flex gap-2 flex-wrap">
          <button onclick="previewSheets()"
            class="px-4 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold">
            <i class="fas fa-eye mr-1"></i>プレビュー確認
          </button>
          <button onclick="syncSheets()"
            class="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm">
            <i class="fas fa-cloud-download-alt mr-1"></i>Sheetsから同期実行
          </button>
          <button onclick="showManualImport()"
            class="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold">
            <i class="fas fa-file-import mr-1"></i>手動JSON
          </button>
        </div>
      </div>

      <!-- プレビュー結果 -->
      <div id="preview-result" class="hidden mt-4 p-4 rounded-xl bg-gray-900/50 border border-white/10">
        <p class="text-sm font-bold text-yellow-400 mb-2">📊 シートプレビュー</p>
        <div id="preview-content" class="text-xs text-gray-300 space-y-1"></div>
      </div>

      <!-- 同期結果 -->
      <div id="sync-result" class="hidden mt-4 p-4 rounded-xl">
        <p id="sync-result-text" class="text-sm font-bold mb-2"></p>
        <div id="sync-result-detail" class="text-xs space-y-1"></div>
      </div>

      <!-- 手動インポート -->
      <div id="manual-import" class="hidden mt-4 p-4 rounded-xl bg-black/30 border border-white/10">
        <h3 class="text-sm font-bold text-yellow-400 mb-1">手動JSONインポート</h3>
        <p class="text-xs text-gray-400 mb-2">フォーマット例:</p>
        <pre class="text-xs text-gray-500 bg-black/30 rounded p-2 mb-2 overflow-x-auto">[{"name":"田中","bets":[{"country_code":"JPN","points":40},{"country_code":"BRA","points":60}]}]</pre>
        <textarea id="manual-json" rows="6"
          placeholder='[{"name":"田中","bets":[{"country_code":"JPN","points":50},{"country_code":"BRA","points":50}]}]'
          class="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white text-xs font-mono mb-2 focus:outline-none focus:border-yellow-400"></textarea>
        <button onclick="importManual()"
          class="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm">
          インポート実行
        </button>
      </div>
    </section>

    <!-- 優勝・敗退管理 -->
    <section id="countries-section" class="hidden p-5 rounded-2xl bg-white/5 border border-white/10">
      <h2 class="text-lg font-bold text-yellow-400 mb-4">
        <i class="fas fa-futbol mr-2"></i>試合結果・チーム管理
      </h2>
      <div class="mb-4 flex gap-2 flex-wrap">
        <button onclick="setWinnerMode()" id="btn-winner-mode"
          class="px-4 py-2 rounded-xl bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-bold">
          <i class="fas fa-trophy mr-1"></i>優勝国設定
        </button>
        <button onclick="setEliminateMode()" id="btn-elim-mode"
          class="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white text-sm font-bold">
          <i class="fas fa-times mr-1"></i>敗退設定
        </button>
        <button onclick="resetWinner()"
          class="px-4 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm">
          優勝リセット
        </button>
        <button onclick="loadCountries()"
          class="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm">
          <i class="fas fa-refresh mr-1"></i>更新
        </button>
      </div>
      <div id="mode-label" class="text-sm text-gray-400 mb-3">
        モードを選択してチームをクリックしてください
      </div>
      <div id="admin-countries-grid" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
      </div>
    </section>

    <!-- 参加者管理 -->
    <section id="participants-section" class="hidden p-5 rounded-2xl bg-white/5 border border-white/10">
      <h2 class="text-lg font-bold text-yellow-400 mb-4">
        <i class="fas fa-users mr-2"></i>参加者管理
      </h2>
      <div id="admin-participants-list" class="space-y-2">
      </div>
    </section>

    <!-- 危険ゾーン -->
    <section id="danger-section" class="hidden p-5 rounded-2xl bg-red-900/20 border border-red-500/30">
      <h2 class="text-lg font-bold text-red-400 mb-4">
        <i class="fas fa-exclamation-triangle mr-2"></i>危険操作
      </h2>
      <button onclick="resetAll()"
        class="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white text-sm font-bold">
        全データリセット（全賭け・参加者削除）
      </button>
    </section>

  </main>

  <script>
    let adminPassword = ''
    let currentMode = null
    let allAdminCountries = []

    async function authenticate() {
      adminPassword = document.getElementById('admin-password').value
      try {
        const res = await fetch('/api/admin/summary', {
          headers: { 'X-Admin-Password': adminPassword }
        })
        if (res.ok) {
          document.getElementById('auth-modal').classList.add('hidden')
          document.getElementById('admin-info').classList.remove('hidden')
          document.querySelectorAll('[id$="-section"]').forEach(s => s.classList.remove('hidden'))
          loadSummary()
          loadCountries()
          loadParticipants()
        } else {
          document.getElementById('auth-error').classList.remove('hidden')
        }
      } catch (e) {
        document.getElementById('auth-error').classList.remove('hidden')
      }
    }

    async function loadSummary() {
      const res = await fetch('/api/admin/summary', { headers: { 'X-Admin-Password': adminPassword } })
      const json = await res.json()
      const d = json.data
      document.getElementById('summary-cards').innerHTML = \`
        <div class="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
          <p class="text-3xl font-bold text-yellow-400">\${d.participants}</p>
          <p class="text-sm text-gray-400">参加者数</p>
        </div>
        <div class="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
          <p class="text-3xl font-bold text-blue-400">\${d.total_bet_points}</p>
          <p class="text-sm text-gray-400">総賭けポイント</p>
        </div>
        <div class="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
          <p class="text-3xl font-bold text-red-400">\${d.eliminated_teams}</p>
          <p class="text-sm text-gray-400">敗退チーム数</p>
        </div>
        <div class="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
          <p class="text-2xl font-bold \${d.winner ? 'text-green-400' : 'text-gray-500'}">\${d.winner ? d.winner.flag_emoji + d.winner.name_ja : '未定'}</p>
          <p class="text-sm text-gray-400">優勝国</p>
        </div>
      \`
    }

    async function loadCountries() {
      const res = await fetch('/api/countries')
      const json = await res.json()
      allAdminCountries = json.data || []
      renderAdminCountries()
    }

    function renderAdminCountries() {
      const grid = document.getElementById('admin-countries-grid')
      grid.innerHTML = allAdminCountries.map(c => \`
        <div onclick="handleCountryClick(\${c.country_id})"
          class="cursor-pointer p-2 rounded-xl border text-sm transition-all \${
            c.is_winner ? 'border-yellow-500 bg-yellow-500/20' :
            c.eliminated ? 'border-red-500/50 bg-red-900/20 opacity-60' :
            'border-white/10 bg-white/5 hover:bg-white/10'
          }">
          <div class="flex items-center gap-2">
            <span class="text-xl">\${c.flag_emoji || '🏳️'}</span>
            <div class="flex-1 min-w-0">
              <p class="font-bold text-xs truncate">\${c.country_name_ja}</p>
              <p class="text-xs text-gray-400">G\${c.group_name || '-'}</p>
            </div>
            \${c.is_winner ? '<span class="text-yellow-400">🏆</span>' :
              c.eliminated ? '<span class="text-red-400 text-xs">×</span>' : ''}
          </div>
        </div>
      \`).join('')
    }

    function setWinnerMode() {
      currentMode = 'winner'
      document.getElementById('mode-label').innerHTML =
        '<i class="fas fa-trophy text-yellow-400 mr-1"></i>優勝国設定モード: チームをクリックして優勝国に設定'
      document.getElementById('mode-label').className = 'text-sm text-yellow-400 mb-3'
    }

    function setEliminateMode() {
      currentMode = 'eliminate'
      document.getElementById('mode-label').innerHTML =
        '<i class="fas fa-times text-red-400 mr-1"></i>敗退設定モード: チームをクリックして敗退/復活を切り替え'
      document.getElementById('mode-label').className = 'text-sm text-red-400 mb-3'
    }

    async function handleCountryClick(countryId) {
      if (!currentMode) {
        alert('上のボタンからモードを選択してください')
        return
      }

      if (currentMode === 'winner') {
        if (!confirm('このチームを優勝国に設定しますか？')) return
        await fetch('/api/admin/set-winner', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Password': adminPassword },
          body: JSON.stringify({ country_id: countryId })
        })
      } else if (currentMode === 'eliminate') {
        const country = allAdminCountries.find(c => c.country_id === countryId)
        if (country.eliminated) {
          await fetch('/api/admin/restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Admin-Password': adminPassword },
            body: JSON.stringify({ country_id: countryId })
          })
        } else {
          const round = prompt('ラウンド名を入力 (例: グループステージ, ベスト16, 準々決勝, 準決勝)')
          if (!round) return
          await fetch('/api/admin/eliminate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Admin-Password': adminPassword },
            body: JSON.stringify({ country_id: countryId, round })
          })
        }
      }

      loadCountries()
      loadSummary()
    }

    async function resetWinner() {
      if (!confirm('優勝国設定をリセットしますか？')) return
      await fetch('/api/admin/reset-winner', {
        method: 'POST',
        headers: { 'X-Admin-Password': adminPassword }
      })
      loadCountries()
      loadSummary()
    }

    async function loadParticipants() {
      const res = await fetch('/api/admin/participants', {
        headers: { 'X-Admin-Password': adminPassword }
      })
      const json = await res.json()
      const list = document.getElementById('admin-participants-list')
      if (!json.data || json.data.length === 0) {
        list.innerHTML = '<p class="text-gray-400 text-sm">参加者なし</p>'
        return
      }
      list.innerHTML = json.data.map(p => \`
        <div class="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
          <div>
            <p class="font-bold">\${p.name}</p>
            <p class="text-xs text-gray-400">賭け合計: \${p.total_bet}pts</p>
            \${p.bet_details ? \`<p class="text-xs text-gray-500 truncate max-w-xs">\${p.bet_details}</p>\` : ''}
          </div>
          <button onclick="deleteParticipant(\${p.id}, '\${p.name}')"
            class="text-red-400 hover:text-red-300 text-sm px-3 py-1 rounded-lg bg-red-900/20 hover:bg-red-900/40">
            削除
          </button>
        </div>
      \`).join('')
    }

    async function deleteParticipant(id, name) {
      if (!confirm(name + 'を削除しますか？賭けデータも削除されます。')) return
      await fetch('/api/participants/' + id, {
        method: 'DELETE',
        headers: { 'X-Admin-Password': adminPassword }
      })
      loadParticipants()
      loadSummary()
    }

    function toggleGuide() {
      const el = document.getElementById('sheets-guide')
      el.classList.toggle('hidden')
    }

    // URL から Spreadsheet ID を自動抽出
    function extractSheetId(input) {
      const val = input.value.trim()
      const m = val.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
      const display = document.getElementById('sheet-id-display')
      if (m) {
        display.textContent = '✅ ID: ' + m[1]
        display.classList.remove('hidden')
      } else {
        display.classList.add('hidden')
      }
    }

    function getSheetInputs() {
      const rawId = document.getElementById('spreadsheet-id').value.trim()
      const m = rawId.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
      const spreadsheet_id = m ? m[1] : rawId
      const api_key = document.getElementById('api-key').value.trim()
      const sheet_name = document.getElementById('sheet-name').value.trim() || undefined
      const overwrite = document.getElementById('overwrite-mode').checked
      return { spreadsheet_id, api_key, sheet_name, overwrite }
    }

    async function previewSheets() {
      const { spreadsheet_id, api_key, sheet_name } = getSheetInputs()
      if (!spreadsheet_id || !api_key) {
        alert('スプレッドシートIDとAPIキーを入力してください')
        return
      }
      const previewDiv = document.getElementById('preview-result')
      const previewContent = document.getElementById('preview-content')
      previewDiv.classList.remove('hidden')
      previewContent.innerHTML = '<p class="text-gray-400 animate-pulse">読み込み中...</p>'

      try {
        const res = await fetch('/api/admin/preview-sheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Password': adminPassword },
          body: JSON.stringify({ spreadsheet_id, api_key, sheet_name })
        })
        const json = await res.json()
        if (!json.success) {
          previewContent.innerHTML = \`<p class="text-red-400">❌ \${json.error}</p>\`
          return
        }
        const nameIdx = json.name_col_index
        const betCols = json.bet_cols || []
        previewContent.innerHTML = \`
          <p class="text-green-400 font-bold">✅ シート: \${json.target_sheet}</p>
          <p>利用可能なシート: \${json.sheets.join(', ')}</p>
          <p class="mt-1">名前列: <span class="text-yellow-300">列\${nameIdx + 1} = "\${json.headers[nameIdx] || '?'}"</span></p>
          <p>認識した国列: <span class="text-blue-300">\${betCols.length}列</span>
            \${betCols.length > 0 ? '(' + betCols.slice(0, 5).map(c => c.header).join(', ') + (betCols.length > 5 ? '...' : '') + ')' : ''}</p>
          \${json.sample_rows.length > 0 ? \`
          <div class="mt-2">
            <p class="text-gray-400">サンプル回答 (先頭\${json.sample_rows.length}件):</p>
            \${json.sample_rows.map(row => \`
              <div class="bg-black/20 rounded p-2 mt-1">
                名前: <span class="text-white">\${row[nameIdx] || '(空)'}</span>
                — ポイント入力あり: \${betCols.filter(c => row[c.index] && parseInt(row[c.index]) > 0).length}国
              </div>
            \`).join('')}
          </div>\` : ''}
        \`
      } catch (e) {
        previewContent.innerHTML = \`<p class="text-red-400">❌ \${e.message}</p>\`
      }
    }

    async function syncSheets() {
      const { spreadsheet_id, api_key, sheet_name, overwrite } = getSheetInputs()
      if (!spreadsheet_id || !api_key) {
        alert('スプレッドシートIDとAPIキーを入力してください')
        return
      }

      const resultDiv = document.getElementById('sync-result')
      const resultText = document.getElementById('sync-result-text')
      const resultDetail = document.getElementById('sync-result-detail')
      resultDiv.classList.remove('hidden')
      resultDiv.className = 'mt-4 p-4 rounded-xl bg-gray-900/50 border border-white/10'
      resultText.textContent = '⏳ 同期中...'
      resultDetail.innerHTML = ''

      try {
        const res = await fetch('/api/admin/sync-sheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Password': adminPassword },
          body: JSON.stringify({ spreadsheet_id, api_key, sheet_name, overwrite })
        })
        const json = await res.json()

        if (json.success) {
          resultDiv.className = 'mt-4 p-4 rounded-xl bg-green-900/20 border border-green-500/30'
          resultText.textContent = \`✅ 同期完了 [シート: \${json.sheet}]\`
          let detail = \`<p class="text-green-300">インポート成功: \${json.imported}件</p>\`
          if (json.skipped > 0) detail += \`<p class="text-gray-400">スキップ (既存): \${json.skipped}件</p>\`
          if (json.errors.length > 0) {
            detail += \`<p class="text-red-400 mt-1">エラー \${json.errors.length}件:</p>\`
            detail += json.errors.slice(0, 5).map(e =>
              \`<p class="text-red-300 ml-2">• \${e.name}: \${e.error}</p>\`
            ).join('')
          }
          if (json.unmatched_columns.length > 0) {
            detail += \`<p class="text-yellow-400 mt-1">⚠ 国として認識できなかった列: \${json.unmatched_columns.join(', ')}</p>\`
          }
          if (json.results.length > 0) {
            detail += \`<div class="mt-2 space-y-1">\` +
              json.results.map(r =>
                \`<p class="text-gray-300">• \${r.name} — \${r.total_points}pts / \${r.bets}国</p>\`
              ).join('') + \`</div>\`
          }
          resultDetail.innerHTML = detail
          loadParticipants()
          loadSummary()
        } else {
          resultDiv.className = 'mt-4 p-4 rounded-xl bg-red-900/20 border border-red-500/30'
          resultText.textContent = '❌ 同期失敗'
          resultDetail.innerHTML = \`<p class="text-red-300">\${json.error}</p>\`
        }
      } catch (e) {
        resultDiv.className = 'mt-4 p-4 rounded-xl bg-red-900/20 border border-red-500/30'
        resultText.textContent = '❌ 通信エラー'
        resultDetail.innerHTML = \`<p class="text-red-300">\${e.message}</p>\`
      }
    }

    function showManualImport() {
      const el = document.getElementById('manual-import')
      el.classList.toggle('hidden')
    }

    async function importManual() {
      const jsonText = document.getElementById('manual-json').value.trim()
      try {
        const rows = JSON.parse(jsonText)
        const res = await fetch('/api/bets/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows })
        })
        const json = await res.json()
        alert('インポート完了: ' + json.results.length + '件成功, エラー: ' + json.errors.length + '件')
        loadParticipants()
        loadSummary()
      } catch (e) {
        alert('JSONの形式が正しくありません: ' + e.message)
      }
    }

    async function resetAll() {
      if (!confirm('⚠️ 全参加者・賭けデータを削除しますか？この操作は取り消せません！')) return
      if (!confirm('本当に全データをリセットしますか？')) return
      await fetch('/api/admin/reset-all', {
        method: 'POST',
        headers: { 'X-Admin-Password': adminPassword }
      })
      alert('全データをリセットしました')
      loadParticipants()
      loadSummary()
    }
  </script>
</body>
</html>`
}

function worldcupPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>⚽ W杯情報 | WC2026</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    .trophy-bg { background: linear-gradient(135deg, #0d1b2a 0%, #1b2838 50%, #0d2137 100%); }
    .card-hover { transition: all 0.2s ease; }
    .card-hover:hover { transform: translateY(-1px); }
    .live-pulse { animation: live 1.5s ease-in-out infinite; }
    @keyframes live { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
    .bracket-line { border-color: rgba(255,255,255,0.2); }
    .match-card { transition: all 0.2s ease; }
    .match-card:hover { background: rgba(255,255,255,0.08) !important; }
    .winner-team { background: linear-gradient(135deg, rgba(246,211,101,0.2), rgba(253,160,133,0.1)); border-color: #f6d365 !important; }
    .tab-active { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important; color:white !important; }
    .scrollbar-hide::-webkit-scrollbar { display:none; }
    .stage-badge-group { background: rgba(59,130,246,0.2); color: #93c5fd; border: 1px solid rgba(59,130,246,0.3); }
    .stage-badge-r32 { background: rgba(168,85,247,0.2); color: #d8b4fe; border: 1px solid rgba(168,85,247,0.3); }
    .stage-badge-r16 { background: rgba(239,68,68,0.2); color: #fca5a5; border: 1px solid rgba(239,68,68,0.3); }
    .stage-badge-qf  { background: rgba(249,115,22,0.2); color: #fdba74; border: 1px solid rgba(249,115,22,0.3); }
    .stage-badge-sf  { background: rgba(234,179,8,0.2); color: #fde047; border: 1px solid rgba(234,179,8,0.3); }
    .stage-badge-final{ background: rgba(234,179,8,0.4); color: #fef08a; border: 1px solid rgba(234,179,8,0.5); }
  </style>
</head>
<body class="trophy-bg min-h-screen text-white">

  <!-- ヘッダー -->
  <header class="bg-black/40 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-2">
      <div class="flex items-center gap-3">
        <a href="/" class="text-gray-400 hover:text-white text-lg"><i class="fas fa-arrow-left"></i></a>
        <span class="text-2xl">⚽</span>
        <div>
          <h1 class="text-xl font-bold text-white">FIFA ワールドカップ 2026</h1>
          <p class="text-xs text-blue-400">USA · Mexico · Canada | Jun 11 – Jul 19, 2026</p>
        </div>
      </div>
      <div class="flex gap-2 flex-wrap">
        <button onclick="showView('today')" id="btn-today"
          class="view-btn px-3 py-1.5 rounded-lg text-sm font-bold bg-green-600 text-white">
          <i class="fas fa-calendar-day mr-1"></i>本日の試合
        </button>
        <button onclick="showView('groups')" id="btn-groups"
          class="view-btn px-3 py-1.5 rounded-lg text-sm bg-white/10 text-white hover:bg-white/20">
          <i class="fas fa-table mr-1"></i>グループ
        </button>
        <button onclick="showView('bracket')" id="btn-bracket"
          class="view-btn px-3 py-1.5 rounded-lg text-sm bg-white/10 text-white hover:bg-white/20">
          <i class="fas fa-sitemap mr-1"></i>トーナメント
        </button>
        <button onclick="showView('schedule')" id="btn-schedule"
          class="view-btn px-3 py-1.5 rounded-lg text-sm bg-white/10 text-white hover:bg-white/20">
          <i class="fas fa-list mr-1"></i>全試合
        </button>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-4 py-5">

    <!-- ローディング -->
    <div id="loading" class="text-center py-16">
      <div class="text-4xl mb-3">⚽</div>
      <p class="text-gray-400 animate-pulse">データを読み込み中...</p>
    </div>

    <!-- 本日の試合 -->
    <section id="view-today" class="hidden">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-xl font-bold text-white"><i class="fas fa-calendar-day text-green-400 mr-2"></i>本日の試合</h2>
        <button onclick="loadAll()" class="text-xs text-gray-400 hover:text-white px-2 py-1 rounded bg-white/10">
          <i class="fas fa-sync mr-1"></i>更新
        </button>
      </div>
      <div id="today-list" class="space-y-3"></div>
    </section>

    <!-- グループステージ -->
    <section id="view-groups" class="hidden">
      <h2 class="text-xl font-bold text-white mb-4"><i class="fas fa-table text-blue-400 mr-2"></i>グループステージ順位表</h2>
      <div id="groups-grid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"></div>
    </section>

    <!-- トーナメントブラケット -->
    <section id="view-bracket" class="hidden">
      <h2 class="text-xl font-bold text-white mb-4"><i class="fas fa-sitemap text-purple-400 mr-2"></i>ノックアウトステージ</h2>

      <!-- ステージタブ -->
      <div class="flex gap-2 mb-5 flex-wrap">
        <button onclick="showStage('r32')" id="stage-r32"
          class="stage-btn px-3 py-1.5 rounded-lg text-xs font-bold stage-badge-r32">ラウンド32</button>
        <button onclick="showStage('r16')" id="stage-r16"
          class="stage-btn px-3 py-1.5 rounded-lg text-xs font-bold stage-badge-r16">ラウンド16</button>
        <button onclick="showStage('qf')" id="stage-qf"
          class="stage-btn px-3 py-1.5 rounded-lg text-xs font-bold stage-badge-qf">準々決勝</button>
        <button onclick="showStage('sf')" id="stage-sf"
          class="stage-btn px-3 py-1.5 rounded-lg text-xs font-bold stage-badge-sf">準決勝</button>
        <button onclick="showStage('final')" id="stage-final"
          class="stage-btn px-3 py-1.5 rounded-lg text-xs font-bold stage-badge-final">決勝・3位決定</button>
      </div>

      <div id="bracket-r32" class="bracket-stage"></div>
      <div id="bracket-r16" class="bracket-stage hidden"></div>
      <div id="bracket-qf" class="bracket-stage hidden"></div>
      <div id="bracket-sf" class="bracket-stage hidden"></div>
      <div id="bracket-final" class="bracket-stage hidden"></div>
    </section>

    <!-- 全試合スケジュール -->
    <section id="view-schedule" class="hidden">
      <div class="mb-4 flex items-center justify-between flex-wrap gap-3">
        <h2 class="text-xl font-bold text-white"><i class="fas fa-list text-yellow-400 mr-2"></i>全試合一覧</h2>
        <div class="flex gap-2 flex-wrap">
          <button onclick="filterSchedule('all')" id="sched-all"
            class="sched-btn px-3 py-1 rounded-lg text-xs font-bold bg-yellow-500 text-black">全て</button>
          <button onclick="filterSchedule('finished')" id="sched-finished"
            class="sched-btn px-3 py-1 rounded-lg text-xs bg-white/10 text-white hover:bg-white/20">終了</button>
          <button onclick="filterSchedule('scheduled')" id="sched-scheduled"
            class="sched-btn px-3 py-1 rounded-lg text-xs bg-white/10 text-white hover:bg-white/20">予定</button>
        </div>
      </div>
      <div id="schedule-list" class="space-y-2"></div>
    </section>

  </main>

  <script>
    let allMatches = []
    let allGroups = []
    let allTeams = {}
    let currentView = 'today'
    let currentSchedFilter = 'all'
    let currentStage = 'r32'

    const TEAM_JA_MAP = {
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

    const STAGE_LABELS = {
      'group': 'グループS', 'r32': 'R32', 'r16': 'R16',
      'qf': '準々決勝', 'sf': '準決勝', 'third': '3位決定', 'final': '決勝'
    }
    const STAGE_COLORS = {
      'group':'stage-badge-group','r32':'stage-badge-r32','r16':'stage-badge-r16',
      'qf':'stage-badge-qf','sf':'stage-badge-sf','third':'stage-badge-final','final':'stage-badge-final'
    }

    function showView(v) {
      currentView = v
      document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'))
      document.getElementById('view-' + v)?.classList.remove('hidden')
      document.querySelectorAll('.view-btn').forEach(b => {
        b.className = 'view-btn px-3 py-1.5 rounded-lg text-sm bg-white/10 text-white hover:bg-white/20'
      })
      const active = document.getElementById('btn-' + v)
      if (active) active.className = 'view-btn px-3 py-1.5 rounded-lg text-sm font-bold bg-green-600 text-white'
    }

    function showStage(stage) {
      currentStage = stage
      document.querySelectorAll('.bracket-stage').forEach(el => el.classList.add('hidden'))
      document.getElementById('bracket-' + stage)?.classList.remove('hidden')
    }

    function teamHtml(team, label, size = 'md') {
      if (!team) {
        return \`<div class="flex items-center gap-2 \${size === 'sm' ? 'text-xs' : 'text-sm'}">
          <div class="w-6 h-4 bg-white/10 rounded"></div>
          <span class="text-gray-500 italic">\${label || 'TBD'}</span>
        </div>\`
      }
      const nameJa = team.name_ja || team.name_en
      const imgSize = size === 'sm' ? 'w-5 h-3.5' : 'w-7 h-5'
      return \`<div class="flex items-center gap-2 \${size === 'sm' ? 'text-xs' : 'text-sm'}">
        <img src="\${team.flag}" alt="\${team.name_en}" class="\${imgSize} object-cover rounded-sm" onerror="this.style.display='none'">
        <span class="font-medium">\${nameJa}</span>
        <span class="text-gray-500 text-xs">\${team.fifa_code || ''}</span>
      </div>\`
    }

    function scoreDisplay(m) {
      if (m.finished) {
        const hasPen = m.home_score_penalties != null
        return \`<div class="text-center">
          <div class="text-2xl font-bold text-white">\${m.home_score} – \${m.away_score}</div>
          \${hasPen ? \`<div class="text-xs text-yellow-400">PK \${m.home_score_penalties}–\${m.away_score_penalties}</div>\` : ''}
          <div class="text-xs text-gray-500 mt-0.5">終了</div>
        </div>\`
      }
      if (m.time_elapsed === 'live' || m.time_elapsed === 'in_progress') {
        return \`<div class="text-center">
          <div class="text-2xl font-bold text-white">\${m.home_score || 0} – \${m.away_score || 0}</div>
          <div class="text-xs text-red-400 live-pulse font-bold mt-0.5">🔴 LIVE</div>
        </div>\`
      }
      const dateStr = m.local_date ? formatDate(m.local_date) : ''
      return \`<div class="text-center">
        <div class="text-sm font-bold text-gray-400">VS</div>
        <div class="text-xs text-gray-500 mt-1">\${dateStr}</div>
      </div>\`
    }

    function formatDate(dateStr) {
      if (!dateStr) return ''
      // "06/20/2026 13:00" → "6/20 13:00"
      const parts = dateStr.split(' ')
      if (parts.length < 2) return dateStr
      const [m, d] = parts[0].split('/')
      return \`\${parseInt(m)}/\${parseInt(d)} \${parts[1]}\`
    }

    function matchCardHtml(m, compact = false) {
      const isLive = m.time_elapsed === 'live' || m.time_elapsed === 'in_progress'
      const stageLabel = STAGE_LABELS[m.type] || m.type
      const stageClass = STAGE_COLORS[m.type] || 'stage-badge-group'

      if (compact) {
        return \`<div class="match-card p-3 rounded-xl border border-white/10 bg-white/5 flex items-center gap-3 \${isLive ? 'border-red-500/50 bg-red-900/10' : ''}">
          <span class="\${stageClass} px-2 py-0.5 rounded text-xs font-bold flex-shrink-0">\${stageLabel} \${m.group || ''}</span>
          <div class="flex-1 grid grid-cols-3 items-center gap-2">
            <div>\${teamHtml(m.home_team, m.home_team_label, 'sm')}</div>
            \${scoreDisplay(m)}
            <div class="text-right">\${teamHtml(m.away_team, m.away_team_label, 'sm')}</div>
          </div>
        </div>\`
      }

      return \`<div class="match-card p-4 rounded-2xl border border-white/10 bg-white/5 \${isLive ? 'border-red-500/50 bg-red-900/10' : ''}">
        <div class="flex items-center justify-between mb-3">
          <span class="\${stageClass} px-2 py-0.5 rounded text-xs font-bold">\${stageLabel} \${m.group || ''}</span>
          <span class="text-xs text-gray-500">\${m.local_date ? formatDate(m.local_date) : ''}</span>
        </div>
        <div class="grid grid-cols-3 items-center gap-4">
          <div>\${teamHtml(m.home_team, m.home_team_label)}</div>
          \${scoreDisplay(m)}
          <div class="text-right">\${teamHtml(m.away_team, m.away_team_label)}</div>
        </div>
      </div>\`
    }

    function renderToday(matches) {
      const list = document.getElementById('today-list')
      const today = matches.filter(m => {
        if (m.time_elapsed === 'live' || m.time_elapsed === 'in_progress') return true
        if (!m.local_date) return false
        const now = new Date()
        const mm = String(now.getUTCMonth()+1).padStart(2,'0')
        const dd = String(now.getUTCDate()).padStart(2,'0')
        const yyyy = now.getUTCFullYear()
        return m.local_date.startsWith(\`\${mm}/\${dd}/\${yyyy}\`)
      })

      // 直近の終了・予定試合も追加 (本日がなければ直近3日)
      const recentFinished = matches
        .filter(m => m.finished)
        .slice(-4)

      const upcoming = matches
        .filter(m => !m.finished && m.time_elapsed !== 'live')
        .slice(0, 4)

      if (today.length === 0 && recentFinished.length === 0) {
        list.innerHTML = '<p class="text-gray-400 text-center py-8">本日の試合はありません</p>'
      } else {
        let html = ''
        if (today.filter(m => m.time_elapsed === 'live' || m.time_elapsed === 'in_progress').length > 0) {
          html += '<div class="mb-2 text-xs text-red-400 font-bold uppercase tracking-wider">🔴 ライブ</div>'
          html += today.filter(m => m.time_elapsed === 'live' || m.time_elapsed === 'in_progress')
            .map(m => matchCardHtml(m)).join('')
        }
        if (today.filter(m => m.finished).length > 0) {
          html += '<div class="mb-2 mt-4 text-xs text-gray-400 font-bold uppercase tracking-wider">本日の結果</div>'
          html += today.filter(m => m.finished).map(m => matchCardHtml(m)).join('')
        }
        if (today.filter(m => !m.finished && m.time_elapsed !== 'live').length > 0) {
          html += '<div class="mb-2 mt-4 text-xs text-gray-400 font-bold uppercase tracking-wider">本日予定</div>'
          html += today.filter(m => !m.finished && m.time_elapsed !== 'live').map(m => matchCardHtml(m)).join('')
        }
        list.innerHTML = html || '<p class="text-gray-400 text-center py-4">本日の試合情報を確認中...</p>'
      }

      // 最近の結果 + 次の試合
      const recentSection = document.createElement('div')
      recentSection.innerHTML = \`
        <div class="mt-6 grid md:grid-cols-2 gap-4">
          <div>
            <div class="mb-2 text-xs text-gray-400 font-bold uppercase tracking-wider">最近の結果</div>
            \${recentFinished.reverse().map(m => matchCardHtml(m, true)).join('')}
          </div>
          <div>
            <div class="mb-2 text-xs text-gray-400 font-bold uppercase tracking-wider">次の試合</div>
            \${upcoming.map(m => matchCardHtml(m, true)).join('')}
          </div>
        </div>
      \`
      list.appendChild(recentSection)
    }

    function renderGroups(groups) {
      const grid = document.getElementById('groups-grid')
      grid.innerHTML = groups.map(g => {
        const rows = g.teams.map((t, i) => {
          const isAdvance = i < 2
          const is3rd = i === 2
          return \`<tr class="\${isAdvance ? 'bg-green-900/10' : is3rd ? 'bg-yellow-900/5' : ''}">
            <td class="py-2 pl-3 pr-1">
              <span class="w-5 h-5 rounded-full inline-flex items-center justify-center text-xs font-bold
                \${isAdvance ? 'bg-green-500 text-black' : is3rd ? 'bg-yellow-600 text-white' : 'bg-white/10 text-gray-400'}">\${i+1}</span>
            </td>
            <td class="py-2 pr-2">
              <div class="flex items-center gap-2">
                \${t.flag ? \`<img src="\${t.flag}" alt="\${t.name_en}" class="w-6 h-4 object-cover rounded-sm">\` : ''}
                <div>
                  <p class="text-sm font-medium leading-tight">\${t.name_ja || t.name_en}</p>
                  <p class="text-xs text-gray-500">\${t.fifa_code}</p>
                </div>
              </div>
            </td>
            <td class="py-2 text-center text-sm text-gray-300">\${t.mp || 0}</td>
            <td class="py-2 text-center text-sm text-green-400">\${t.w || 0}</td>
            <td class="py-2 text-center text-sm text-gray-400">\${t.d || 0}</td>
            <td class="py-2 text-center text-sm text-red-400">\${t.l || 0}</td>
            <td class="py-2 text-center text-sm text-gray-300">\${t.gf || 0}:\${t.ga || 0}</td>
            <td class="py-2 text-center text-sm \${parseInt(t.gd) >= 0 ? 'text-green-400' : 'text-red-400'}">\${parseInt(t.gd) > 0 ? '+' : ''}\${t.gd || 0}</td>
            <td class="py-2 pr-3 text-center font-bold text-yellow-400">\${t.pts || 0}</td>
          </tr>\`
        }).join('')
        return \`<div class="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
          <div class="px-4 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
            <h3 class="font-bold text-yellow-400">グループ \${g.group}</h3>
            <span class="text-xs text-gray-500">試 勝 分 敗 得:失 差 点</span>
          </div>
          <table class="w-full">
            <tbody>\${rows}</tbody>
          </table>
          <div class="px-3 py-2 border-t border-white/5 flex gap-3 text-xs text-gray-500">
            <span><span class="inline-block w-3 h-3 rounded-full bg-green-500 mr-1"></span>決勝T進出</span>
            <span><span class="inline-block w-3 h-3 rounded-full bg-yellow-600 mr-1"></span>3位通過候補</span>
          </div>
        </div>\`
      }).join('')
    }

    function renderBracket(matches) {
      const stages = ['r32', 'r16', 'qf', 'sf', 'final']
      const stageMap = { r32: [], r16: [], qf: [], sf: [], final: [] }

      for (const m of matches) {
        if (m.type === 'r32') stageMap.r32.push(m)
        else if (m.type === 'r16') stageMap.r16.push(m)
        else if (m.type === 'qf') stageMap.qf.push(m)
        else if (m.type === 'sf') stageMap.sf.push(m)
        else if (m.type === 'final' || m.type === 'third') stageMap.final.push(m)
      }

      stages.forEach(stage => {
        const el = document.getElementById('bracket-' + stage)
        if (!el) return
        const ms = stageMap[stage]
        if (ms.length === 0) {
          el.innerHTML = '<p class="text-gray-500 text-center py-8 text-sm">試合はまだ決定していません</p>'
          return
        }
        el.innerHTML = '<div class="grid grid-cols-1 md:grid-cols-2 gap-3">' +
          ms.sort((a,b) => parseInt(a.id) - parseInt(b.id))
            .map(m => matchCardHtml(m)).join('') +
          '</div>'
      })
    }

    function filterSchedule(type) {
      currentSchedFilter = type
      document.querySelectorAll('.sched-btn').forEach(b => {
        b.className = 'sched-btn px-3 py-1 rounded-lg text-xs bg-white/10 text-white hover:bg-white/20'
      })
      document.getElementById('sched-' + type).className =
        'sched-btn px-3 py-1 rounded-lg text-xs font-bold bg-yellow-500 text-black'
      renderSchedule()
    }

    function renderSchedule() {
      const list = document.getElementById('schedule-list')
      let matches = allMatches
      if (currentSchedFilter === 'finished') matches = matches.filter(m => m.finished)
      if (currentSchedFilter === 'scheduled') matches = matches.filter(m => !m.finished)

      // 日付でグループ化
      const byDate = {}
      for (const m of matches) {
        const key = m.local_date?.split(' ')[0] || 'TBD'
        if (!byDate[key]) byDate[key] = []
        byDate[key].push(m)
      }

      list.innerHTML = Object.entries(byDate).map(([date, ms]) => {
        const [mo, da, yr] = date.split('/')
        const label = date !== 'TBD' ? \`\${yr}年\${parseInt(mo)}月\${parseInt(da)}日\` : '日程未定'
        return \`<div class="mb-4">
          <div class="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2 px-1">\${label}</div>
          <div class="space-y-2">\${ms.map(m => matchCardHtml(m, true)).join('')}</div>
        </div>\`
      }).join('')
    }

    // Node.jsプロキシのベースURL (ポート3001)
    // サンドボックス環境では hostname のポート番号部分を3001に差し替える
    function proxyBase() {
      const host = window.location.hostname
      const proto = window.location.protocol
      // "3000-xxxx..." 形式の場合はポートを3001に差し替え
      const proxyHost = host.replace(/^3000-/, '3001-')
      return proxyHost !== host
        ? \`\${proto}//\${proxyHost}\`
        : \`http://localhost:3001\`
    }

    async function loadAll() {
      document.getElementById('loading').classList.remove('hidden')
      document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'))

      const base = proxyBase()
      try {
        // グループ順位 + チーム (Node.jsプロキシ経由)
        const [groupRes, teamsRes] = await Promise.all([
          fetch(base + '/proxy/wc/standings'),
          fetch(base + '/proxy/wc/teams'),
        ])
        const groupData = await groupRes.json()
        const teamsData = await teamsRes.json()

        if (groupData.success) allGroups = groupData.groups || []
        if (teamsData.success) {
          for (const t of teamsData.teams) allTeams[t.id] = t
        }

        renderGroups(allGroups)
        document.getElementById('loading').classList.add('hidden')
        showView(currentView)

        // 試合データはプロキシ経由で非同期取得
        loadMatchesViaProxy()

      } catch (e) {
        document.getElementById('loading').innerHTML =
          '<p class="text-red-400 text-center py-8">データの取得に失敗しました。時間をおいて再試行してください。</p>'
      }
    }

    // Node.jsプロキシ経由で試合データ取得
    async function loadMatchesViaProxy() {
      try {
        const base = proxyBase()
        const res = await fetch(base + '/proxy/wc/matches')
        const data = await res.json()
        if (!data.success) throw new Error(data.error || 'proxy error')

        // name_jaをTEAM_JA_MAPで補完
        allMatches = (data.matches || []).map(m => ({
          ...m,
          home_team: m.home_team ? { ...m.home_team, name_ja: TEAM_JA_MAP[String(m.home_team.id)] || m.home_team.name_en } : null,
          away_team: m.away_team ? { ...m.away_team, name_ja: TEAM_JA_MAP[String(m.away_team.id)] || m.away_team.name_en } : null,
        }))

        renderToday(allMatches)
        renderBracket(allMatches)
        renderSchedule()
        if (['today','bracket','schedule'].includes(currentView)) {
          showView(currentView)
        }
      } catch (e) {
        console.warn('試合データ取得失敗:', e)
        document.getElementById('today-list').innerHTML =
          '<p class="text-yellow-400 text-sm text-center py-6"><i class="fas fa-exclamation-triangle mr-1"></i>試合データの取得に失敗しました。</p>'
      }
    }

    // 初期ロード
    loadAll()
    // 60秒ごと自動更新
    setInterval(loadAll, 60000)
  </script>
</body>
</html>`
}

export default app
