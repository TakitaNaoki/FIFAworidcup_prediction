import { Hono } from 'hono'
import { Bindings, OddsData } from '../types'

const countries = new Hono<{ Bindings: Bindings }>()

// 全国一覧 + オッズ計算
countries.get('/', async (c) => {
  const db = c.env.DB

  // 全国取得
  const countriesResult = await db.prepare(`
    SELECT c.*,
      COALESCE(SUM(b.points), 0) as total_bet_points
    FROM countries c
    LEFT JOIN bets b ON c.id = b.country_id
    GROUP BY c.id
    ORDER BY c.group_name, c.name_ja
  `).all()

  // 全体の賭けポイント合計
  const totalResult = await db.prepare(`
    SELECT COALESCE(SUM(points), 0) as total FROM bets
  `).first<{ total: number }>()

  const totalBetPoints = totalResult?.total ?? 0

  const oddsData: OddsData[] = countriesResult.results.map((row: any) => {
    const betPoints = row.total_bet_points as number
    // パリミュチュエル方式: オッズ = 総賭けポイント / その国への賭けポイント
    // 最低オッズは1.0 (賭けがない場合は暫定表示)
    const odds = betPoints > 0
      ? Math.round((totalBetPoints / betPoints) * 100) / 100
      : 0

    return {
      country_id: row.id,
      country_name: row.name,
      country_name_ja: row.name_ja,
      country_code: row.code,
      flag_emoji: row.flag_emoji,
      group_name: row.group_name,
      total_bet_points: betPoints,
      odds,
      eliminated: row.eliminated,
      is_winner: row.is_winner,
    }
  })

  return c.json({ success: true, data: oddsData, total_bet_points: totalBetPoints })
})

// 特定の国の詳細
countries.get('/:id', async (c) => {
  const id = c.req.param('id')
  const db = c.env.DB

  const country = await db.prepare(`
    SELECT c.*,
      COALESCE(SUM(b.points), 0) as total_bet_points,
      COUNT(DISTINCT b.participant_id) as bettors_count
    FROM countries c
    LEFT JOIN bets b ON c.id = b.country_id
    WHERE c.id = ?
    GROUP BY c.id
  `).bind(id).first()

  if (!country) {
    return c.json({ success: false, error: 'Country not found' }, 404)
  }

  return c.json({ success: true, data: country })
})

// 国の状態更新 (管理者のみ: 敗退・優勝設定)
countries.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const db = c.env.DB
  const body = await c.req.json<{
    eliminated?: number
    eliminated_round?: string
    is_winner?: number
  }>()

  const updates: string[] = []
  const values: any[] = []

  if (body.eliminated !== undefined) {
    updates.push('eliminated = ?')
    values.push(body.eliminated)
  }
  if (body.eliminated_round !== undefined) {
    updates.push('eliminated_round = ?')
    values.push(body.eliminated_round)
  }
  if (body.is_winner !== undefined) {
    updates.push('is_winner = ?')
    values.push(body.is_winner)
  }

  if (updates.length === 0) {
    return c.json({ success: false, error: 'No fields to update' }, 400)
  }

  values.push(id)
  await db.prepare(`
    UPDATE countries SET ${updates.join(', ')} WHERE id = ?
  `).bind(...values).run()

  return c.json({ success: true })
})

export default countries
