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

// Google Sheets から賭けを同期
admin.post('/sync-sheets', async (c) => {
  const apiKey = c.env.GOOGLE_SHEETS_API_KEY
  const spreadsheetId = c.env.GOOGLE_SPREADSHEET_ID
  const db = c.env.DB

  if (!apiKey || !spreadsheetId) {
    return c.json({
      success: false,
      error: 'Google Sheets APIキーまたはスプレッドシートIDが設定されていません'
    }, 400)
  }

  try {
    // Google Sheets API でデータ取得
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/シート1!A:AZ?key=${apiKey}`
    const response = await fetch(url)
    const data = await response.json() as any

    if (!data.values || data.values.length < 2) {
      return c.json({ success: false, error: 'データが見つかりません' }, 400)
    }

    const headers = data.values[0] as string[]
    const rows = data.values.slice(1) as string[][]

    // ヘッダー解析: "タイムスタンプ", "お名前", "国名(pts)"...
    const nameColIndex = headers.findIndex(h =>
      h.includes('名前') || h.includes('name') || h.toLowerCase().includes('name')
    )

    if (nameColIndex === -1) {
      return c.json({ success: false, error: '名前の列が見つかりません' }, 400)
    }

    // 全国コードのマッピング取得
    const allCountries = await db.prepare(
      'SELECT id, name_ja, code FROM countries'
    ).all<{ id: number; name_ja: string; code: string }>()
    const countryMap = new Map(allCountries.results.map(c => [c.name_ja, c]))
    const countryCodeMap = new Map(allCountries.results.map(c => [c.code, c]))

    const importResults = []
    const importErrors = []

    for (const row of rows) {
      const participantName = row[nameColIndex]?.trim()
      if (!participantName) continue

      try {
        // 参加者取得または作成
        let participant = await db.prepare(
          'SELECT id FROM participants WHERE name = ?'
        ).bind(participantName).first<{ id: number }>()

        if (!participant) {
          const created = await db.prepare(
            'INSERT INTO participants (name) VALUES (?) RETURNING *'
          ).bind(participantName).first<{ id: number }>()
          participant = created!
        }

        // 既存の賭けを削除
        await db.prepare('DELETE FROM bets WHERE participant_id = ?').bind(participant.id).run()

        let totalPoints = 0
        const betsToInsert: { countryId: number; points: number }[] = []

        // 各列を国への賭けとして解析
        for (let i = 0; i < headers.length; i++) {
          if (i === nameColIndex || i === 0) continue // タイムスタンプと名前列をスキップ

          const header = headers[i]
          const value = parseInt(row[i] || '0', 10)
          if (isNaN(value) || value <= 0) continue

          // ヘッダーから国を特定 (日本語名またはコード)
          let country = countryMap.get(header.trim())
          if (!country) {
            // コードで試みる
            const code = header.match(/\(([A-Z]{3})\)/)?.[1]
            if (code) country = countryCodeMap.get(code)
          }

          if (country) {
            betsToInsert.push({ countryId: country.id, points: value })
            totalPoints += value
          }
        }

        if (totalPoints > 100) {
          importErrors.push({ name: participantName, error: `合計${totalPoints}pts > 100pts` })
          continue
        }

        // 賭けを挿入
        for (const bet of betsToInsert) {
          await db.prepare(`
            INSERT INTO bets (participant_id, country_id, points) VALUES (?, ?, ?)
          `).bind(participant.id, bet.countryId, bet.points).run()
        }

        importResults.push({ name: participantName, total_points: totalPoints })
      } catch (e: any) {
        importErrors.push({ name: participantName, error: e.message })
      }
    }

    // ログ記録
    await db.prepare(`
      INSERT INTO sync_logs (rows_processed, status, message)
      VALUES (?, ?, ?)
    `).bind(importResults.length, importErrors.length > 0 ? 'partial' : 'success',
      `Google Sheets同期: 成功${importResults.length}件, エラー${importErrors.length}件`
    ).run()

    return c.json({
      success: true,
      imported: importResults.length,
      errors: importErrors,
      results: importResults
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
