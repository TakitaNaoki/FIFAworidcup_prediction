import { Hono } from 'hono'
import { Bindings } from '../types'

const participants = new Hono<{ Bindings: Bindings }>()

// 参加者一覧 + ランキング計算
participants.get('/', async (c) => {
  const db = c.env.DB

  // 全参加者とその賭けポイント・配当を計算
  const result = await db.prepare(`
    SELECT
      p.id,
      p.name,
      p.initial_points,
      COALESCE(SUM(b.points), 0) as total_bet_points
    FROM participants p
    LEFT JOIN bets b ON p.id = b.participant_id
    GROUP BY p.id
    ORDER BY p.name
  `).all()

  // 優勝国への賭け配当計算
  const totalBetsResult = await db.prepare(`
    SELECT COALESCE(SUM(points), 0) as total FROM bets
  `).first<{ total: number }>()
  const totalBetPoints = totalBetsResult?.total ?? 0

  // 優勝国を確認
  const winner = await db.prepare(`
    SELECT id FROM countries WHERE is_winner = 1 LIMIT 1
  `).first<{ id: number }>()

  const rankings = await Promise.all(result.results.map(async (p: any) => {
    let payout = 0

    if (winner) {
      // 優勝国への賭けポイントを取得
      const betOnWinner = await db.prepare(`
        SELECT COALESCE(points, 0) as points FROM bets
        WHERE participant_id = ? AND country_id = ?
      `).bind(p.id, winner.id).first<{ points: number }>()

      if (betOnWinner && betOnWinner.points > 0 && totalBetPoints > 0) {
        // 優勝国の総賭けポイント
        const countryTotalBet = await db.prepare(`
          SELECT COALESCE(SUM(points), 0) as total FROM bets WHERE country_id = ?
        `).bind(winner.id).first<{ total: number }>()

        const countryTotal = countryTotalBet?.total ?? 0
        if (countryTotal > 0) {
          const odds = totalBetPoints / countryTotal
          payout = Math.floor(betOnWinner.points * odds)
        }
      }
    }

    const remaining = p.initial_points - p.total_bet_points
    const currentPoints = remaining + payout

    return {
      participant_id: p.id,
      name: p.name,
      initial_points: p.initial_points,
      total_bet_points: p.total_bet_points,
      remaining_points: remaining,
      payout,
      net_gain: payout - p.total_bet_points,
      current_points: currentPoints,
    }
  }))

  // ランキング順にソート
  rankings.sort((a, b) => b.current_points - a.current_points)
  const rankedList = rankings.map((r, i) => ({ rank: i + 1, ...r }))

  return c.json({ success: true, data: rankedList, winner_decided: !!winner })
})

// 参加者追加
participants.post('/', async (c) => {
  const db = c.env.DB
  const { name } = await c.req.json<{ name: string }>()

  if (!name || name.trim() === '') {
    return c.json({ success: false, error: '名前を入力してください' }, 400)
  }

  try {
    const result = await db.prepare(`
      INSERT INTO participants (name) VALUES (?) RETURNING *
    `).bind(name.trim()).first()

    return c.json({ success: true, data: result }, 201)
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      return c.json({ success: false, error: 'この名前は既に登録されています' }, 409)
    }
    throw e
  }
})

// 参加者削除 (管理者のみ)
participants.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const db = c.env.DB

  await db.prepare('DELETE FROM bets WHERE participant_id = ?').bind(id).run()
  await db.prepare('DELETE FROM participants WHERE id = ?').bind(id).run()

  return c.json({ success: true })
})

export default participants
