import { Hono } from 'hono'
import { Bindings } from '../types'

const admin = new Hono<{ Bindings: Bindings }>()

// 管理者認証ミドルウェア
admin.use('/*', async (c, next) => {
  const auth = c.req.header('X-Admin-Password')
  const adminPassword = c.env.ADMIN_PASSWORD || 'admin123'

  if (auth !== adminPassword) {
    return c.json({ success: false, error: '認証が必要です' }, 401)
  }
  await next()
})

// ゲームの現在の状態サマリー
admin.get('/summary', async (c) => {
  const db = c.env.DB

  const participantsCount = await db.prepare(
    'SELECT COUNT(*) as count FROM participants'
  ).first<{ count: number }>()

  const betsCount = await db.prepare(
    'SELECT COUNT(*) as count, COALESCE(SUM(points), 0) as total FROM bets'
  ).first<{ count: number; total: number }>()

  const winner = await db.prepare(
    'SELECT * FROM countries WHERE is_winner = 1 LIMIT 1'
  ).first()

  const eliminatedCount = await db.prepare(
    'SELECT COUNT(*) as count FROM countries WHERE eliminated = 1'
  ).first<{ count: number }>()

  const lastSync = await db.prepare(
    'SELECT * FROM sync_logs ORDER BY synced_at DESC LIMIT 1'
  ).first()

  return c.json({
    success: true,
    data: {
      participants: participantsCount?.count ?? 0,
      total_bets: betsCount?.count ?? 0,
      total_bet_points: betsCount?.total ?? 0,
      winner: winner || null,
      eliminated_teams: eliminatedCount?.count ?? 0,
      last_sync: lastSync || null,
    }
  })
})

// 優勝国設定
admin.post('/set-winner', async (c) => {
  const db = c.env.DB
  const { country_id } = await c.req.json<{ country_id: number }>()

  // 既存の優勝国をリセット
  await db.prepare('UPDATE countries SET is_winner = 0').run()

  // 新しい優勝国を設定
  await db.prepare(`
    UPDATE countries SET is_winner = 1, eliminated = 0 WHERE id = ?
  `).bind(country_id).run()

  return c.json({ success: true })
})

// 優勝リセット
admin.post('/reset-winner', async (c) => {
  const db = c.env.DB
  await db.prepare('UPDATE countries SET is_winner = 0').run()
  return c.json({ success: true })
})

// チーム敗退設定
admin.post('/eliminate', async (c) => {
  const db = c.env.DB
  const { country_id, round } = await c.req.json<{
    country_id: number
    round: string
  }>()

  await db.prepare(`
    UPDATE countries
    SET eliminated = 1, eliminated_round = ?, is_winner = 0
    WHERE id = ?
  `).bind(round, country_id).run()

  return c.json({ success: true })
})

// 敗退リセット
admin.post('/restore', async (c) => {
  const db = c.env.DB
  const { country_id } = await c.req.json<{ country_id: number }>()

  await db.prepare(`
    UPDATE countries SET eliminated = 0, eliminated_round = NULL WHERE id = ?
  `).bind(country_id).run()

  return c.json({ success: true })
})

// 全参加者のポイント状況
admin.get('/participants', async (c) => {
  const db = c.env.DB

  const result = await db.prepare(`
    SELECT
      p.id,
      p.name,
      p.initial_points,
      COALESCE(SUM(b.points), 0) as total_bet,
      GROUP_CONCAT(c.name_ja || ':' || b.points) as bet_details
    FROM participants p
    LEFT JOIN bets b ON p.id = b.participant_id
    LEFT JOIN countries c ON b.country_id = c.id
    GROUP BY p.id
    ORDER BY p.name
  `).all()

  return c.json({ success: true, data: result.results })
})

// Google Sheets プレビュー (同期前の確認用)
admin.post('/preview-sheets', async (c) => {
  const body = await c.req.json<{
    spreadsheet_id: string
    api_key: string
    sheet_name?: string
  }>()
  const { spreadsheet_id, api_key, sheet_name } = body

  if (!api_key || !spreadsheet_id) {
    return c.json({ success: false, error: 'APIキーとSpreadsheet IDは必須です' }, 400)
  }

  try {
    // シート一覧を取得
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet_id}?key=${api_key}`
    const metaRes = await fetch(metaUrl)
    const meta = await metaRes.json() as any
    if (meta.error) {
      return c.json({ success: false, error: `Sheets API: ${meta.error.message}` }, 400)
    }

    const sheets = (meta.sheets || []).map((s: any) => s.properties.title)
    const targetSheet = sheet_name || sheets[0] || 'フォームの回答 1'

    // データ取得 (先頭3行 = ヘッダー + サンプル2行)
    const encodedSheet = encodeURIComponent(targetSheet)
    const rangeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet_id}/values/${encodedSheet}!A1:BZ3?key=${api_key}`
    const rangeRes = await fetch(rangeUrl)
    const rangeData = await rangeRes.json() as any
    if (rangeData.error) {
      return c.json({ success: false, error: `シート読み込み失敗: ${rangeData.error.message}` }, 400)
    }

    const values = rangeData.values || []
    const headers = values[0] || []

    // 名前列とbet列を自動検出
    const nameColIndex = headers.findIndex((h: string) =>
      /名前|氏名|name/i.test(h)
    )
    const betCols: { index: number; header: string }[] = []
    const db = c.env.DB
    const allCountries = await db.prepare('SELECT id, name_ja, name, code FROM countries').all<{
      id: number; name_ja: string; name: string; code: string
    }>()
    const countryNames = new Set([
      ...allCountries.results.map(c => c.name_ja),
      ...allCountries.results.map(c => c.name),
      ...allCountries.results.map(c => c.code),
    ])

    for (let i = 0; i < headers.length; i++) {
      if (i === nameColIndex || i === 0) continue
      const h = headers[i].trim()
      const bare = h.replace(/\s*[\[\(（【].*/, '').trim()
      if (countryNames.has(h) || countryNames.has(bare)) {
        betCols.push({ index: i, header: h })
      }
    }

    return c.json({
      success: true,
      sheets,
      target_sheet: targetSheet,
      headers,
      name_col_index: nameColIndex,
      bet_cols: betCols,
      sample_rows: values.slice(1, 3),
    })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// Google Sheets から賭けを同期
admin.post('/sync-sheets', async (c) => {
  const body = await c.req.json<{
    spreadsheet_id: string
    api_key: string
    sheet_name?: string
    overwrite?: boolean   // true = 既存の賭けを上書き, false = スキップ
  }>()
  const { spreadsheet_id, api_key, sheet_name, overwrite = true } = body
  const db = c.env.DB

  if (!api_key || !spreadsheet_id) {
    return c.json({ success: false, error: 'APIキーとSpreadsheet IDは必須です' }, 400)
  }

  try {
    // シート名を解決
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet_id}?key=${api_key}`
    const metaRes = await fetch(metaUrl)
    const meta = await metaRes.json() as any
    if (meta.error) {
      return c.json({ success: false, error: `Sheets API: ${meta.error.message}` }, 400)
    }
    const sheets = (meta.sheets || []).map((s: any) => s.properties.title) as string[]
    const targetSheet = sheet_name || sheets[0] || 'フォームの回答 1'

    // 全行取得
    const encodedSheet = encodeURIComponent(targetSheet)
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet_id}/values/${encodedSheet}!A:BZ?key=${api_key}`
    const response = await fetch(url)
    const data = await response.json() as any
    if (data.error) {
      return c.json({ success: false, error: `データ取得失敗: ${data.error.message}` }, 400)
    }

    if (!data.values || data.values.length < 2) {
      return c.json({ success: false, error: 'シートにデータがありません (ヘッダー行含む2行以上必要)' }, 400)
    }

    const headers = data.values[0] as string[]
    const rows = data.values.slice(1) as string[][]

    // --- 列マッピング解析 ---
    // 名前列: "名前", "お名前", "氏名", "name" を含む列
    const nameColIndex = headers.findIndex(h => /名前|氏名|name/i.test(h))
    if (nameColIndex === -1) {
      return c.json({
        success: false,
        error: `名前の列が見つかりません。ヘッダー: [${headers.join(', ')}]`
      }, 400)
    }

    // 国マッピング: name_ja, name, code すべてで照合
    const allCountries = await db.prepare('SELECT id, name_ja, name, code FROM countries').all<{
      id: number; name_ja: string; name: string; code: string
    }>()
    const countryMap = new Map<string, number>()
    for (const c of allCountries.results) {
      countryMap.set(c.name_ja.trim(), c.id)
      countryMap.set(c.name.trim(), c.id)
      countryMap.set(c.code.trim(), c.id)
      // "国名 [ポイント入力]" のような括弧付きヘッダーにも対応
      const bare = c.name_ja.replace(/\s*[\[\(（【].*/, '').trim()
      if (bare !== c.name_ja) countryMap.set(bare, c.id)
    }

    // ヘッダーの各列がどの国IDに対応するかを事前解決
    const colToCountryId: (number | null)[] = headers.map((h, i) => {
      if (i === nameColIndex || i === 0) return null
      const bare = h.trim().replace(/\s*[\[\(（【].*/, '').trim()
      return countryMap.get(h.trim()) ?? countryMap.get(bare) ?? null
    })

    const unmatchedCols = headers
      .map((h, i) => ({ h, i }))
      .filter(({ i }) => i !== nameColIndex && i !== 0 && colToCountryId[i] === null)
      .map(({ h }) => h)

    const importResults: { name: string; total_points: number; bets: number }[] = []
    const importErrors: { name: string; error: string }[] = []
    const skipped: string[] = []

    for (const row of rows) {
      const participantName = row[nameColIndex]?.trim()
      if (!participantName) continue

      try {
        // 既存参加者チェック
        const existing = await db.prepare(
          'SELECT id FROM participants WHERE name = ?'
        ).bind(participantName).first<{ id: number }>()

        if (existing && !overwrite) {
          skipped.push(participantName)
          continue
        }

        // 参加者 upsert
        let participantId: number
        if (existing) {
          participantId = existing.id
        } else {
          const created = await db.prepare(
            'INSERT INTO participants (name) VALUES (?) RETURNING id'
          ).bind(participantName).first<{ id: number }>()
          participantId = created!.id
        }

        // 賭け解析
        let totalPoints = 0
        const betsToInsert: { countryId: number; points: number }[] = []

        for (let i = 0; i < headers.length; i++) {
          const countryId = colToCountryId[i]
          if (!countryId) continue
          const raw = row[i]?.trim() || '0'
          const pts = parseInt(raw, 10)
          if (isNaN(pts) || pts <= 0) continue
          betsToInsert.push({ countryId, points: pts })
          totalPoints += pts
        }

        if (totalPoints > 100) {
          importErrors.push({ name: participantName, error: `合計${totalPoints}pts超過 (最大100pts)` })
          continue
        }
        if (betsToInsert.length === 0) {
          importErrors.push({ name: participantName, error: '賭けが0件 (ポイント入力なし)' })
          continue
        }

        // 賭け upsert
        await db.prepare('DELETE FROM bets WHERE participant_id = ?').bind(participantId).run()
        for (const bet of betsToInsert) {
          await db.prepare(
            'INSERT INTO bets (participant_id, country_id, points) VALUES (?, ?, ?)'
          ).bind(participantId, bet.countryId, bet.points).run()
        }

        importResults.push({ name: participantName, total_points: totalPoints, bets: betsToInsert.length })
      } catch (e: any) {
        importErrors.push({ name: participantName, error: e.message })
      }
    }

    // ログ記録
    await db.prepare(
      'INSERT INTO sync_logs (rows_processed, status, message) VALUES (?, ?, ?)'
    ).bind(
      importResults.length,
      importErrors.length > 0 ? 'partial' : 'success',
      `Google Sheets同期 [${targetSheet}]: 成功${importResults.length}件, エラー${importErrors.length}件, スキップ${skipped.length}件`
    ).run()

    return c.json({
      success: true,
      sheet: targetSheet,
      imported: importResults.length,
      skipped: skipped.length,
      results: importResults,
      errors: importErrors,
      unmatched_columns: unmatchedCols,
    })

  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// データリセット (全賭けと参加者を削除)
admin.post('/reset-all', async (c) => {
  const db = c.env.DB
  await db.prepare('DELETE FROM bets').run()
  await db.prepare('DELETE FROM participants').run()
  await db.prepare('UPDATE countries SET eliminated = 0, eliminated_round = NULL, is_winner = 0').run()
  return c.json({ success: true })
})

export default admin
