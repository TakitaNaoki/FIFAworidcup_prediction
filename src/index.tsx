import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { Bindings } from './types'
import countriesRoute from './routes/countries'
import participantsRoute from './routes/participants'
import betsRoute from './routes/bets'
import adminRoute from './routes/admin'

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
      <h2 class="text-lg font-bold text-yellow-400 mb-4">
        <i class="fas fa-sync mr-2"></i>Google Sheets 同期
      </h2>
      <div class="grid gap-4">
        <div>
          <label class="block text-sm text-gray-400 mb-1">Spreadsheet ID</label>
          <input type="text" id="spreadsheet-id" placeholder="Google SpreadsheetsのURL内のID"
            class="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-yellow-400">
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">API Key</label>
          <input type="text" id="api-key" placeholder="Google Sheets APIキー"
            class="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-yellow-400">
        </div>
        <div class="flex gap-3">
          <button onclick="syncSheets()"
            class="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold">
            <i class="fas fa-cloud-download-alt mr-2"></i>Sheetsから同期
          </button>
          <button onclick="showManualImport()"
            class="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold">
            <i class="fas fa-file-import mr-2"></i>手動インポート
          </button>
        </div>
        <div id="sync-result" class="hidden p-3 rounded-xl bg-green-900/30 border border-green-500/30">
          <p id="sync-result-text" class="text-sm text-green-400"></p>
        </div>
      </div>

      <!-- 手動インポート -->
      <div id="manual-import" class="hidden mt-4 p-4 rounded-xl bg-black/30 border border-white/10">
        <h3 class="text-sm font-bold text-yellow-400 mb-2">手動JSONインポート</h3>
        <p class="text-xs text-gray-400 mb-2">フォーマット: [{"name": "名前", "bets": [{"country_code": "JPN", "points": 30}, ...]}, ...]</p>
        <textarea id="manual-json" rows="5" placeholder='[{"name":"田中","bets":[{"country_code":"JPN","points":50},{"country_code":"BRA","points":50}]}]'
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

    async function syncSheets() {
      const spreadsheetId = document.getElementById('spreadsheet-id').value.trim()
      const apiKey = document.getElementById('api-key').value.trim()
      if (!spreadsheetId || !apiKey) {
        alert('Spreadsheet IDとAPIキーを入力してください')
        return
      }

      // APIキーとSpreadsheetsIDを一時的に設定 (本来は環境変数で管理)
      const res = await fetch('/api/admin/sync-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': adminPassword },
      })
      const json = await res.json()
      const resultDiv = document.getElementById('sync-result')
      const resultText = document.getElementById('sync-result-text')
      resultDiv.classList.remove('hidden')
      if (json.success) {
        resultText.textContent = '✅ 同期完了: ' + json.imported + '件インポート'
        resultDiv.className = 'p-3 rounded-xl bg-green-900/30 border border-green-500/30'
      } else {
        resultText.textContent = '❌ エラー: ' + json.error
        resultDiv.className = 'p-3 rounded-xl bg-red-900/30 border border-red-500/30'
      }
      loadParticipants()
      loadSummary()
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

export default app
