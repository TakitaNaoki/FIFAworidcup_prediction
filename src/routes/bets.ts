import { Hono } from 'hono'
import { Bindings } from '../types'

const bets = new Hono<{ Bindings: Bindings }>()

// 参加者の賭け状況取得
bets.get('/participant/:participantId', async (c) => {
  const participantId = c.req.param('participantId')
  const db = c.env.DB

  const participant = await db.prepare(
    'SELECT * FROM participants WHERE id = ?'
  ).bind(participantId).first()

  if (!participant) {
    return c.json({ success: false, error: 'Participant not found' }, 404)
  }

  const betsList = await db.prepare(`
    SELECT b.*, c.name_ja, c.name, c.code, c.flag_emoji, c.group_name
    FROM bets b
    JOIN countries c ON b.country_id = c.id
    WHERE b.participant_id = ?
    ORDER BY b.points DESC
  `).bind(participantId).all()

  const totalBet = betsList.results.reduce((sum: number, b: any) => sum + b.points, 0)

  return c.json({
    success: true,
    participant,
    bets: betsList.results,
    total_bet: totalBet,
  })
})

// 賭けを一括設定 (参加者名で識別)
bets.post('/bulk', async (c) => {
  const db = c.env.DB
  const body = await c.req.json<{
    participant_name: string
    bets: { country_id: number; points: number }[]
  }>()

  const { participant_name, bets: betList } = body

  if (!participant_name || !betList || betList.length === 0) {
    return c.json({ success: false, error: '参加者名と賭けデータが必要です' }, 400)
  }

  // 合計ポイントチェック
  const totalPoints = betList.reduce((sum, b) => sum + b.points, 0)
  if (totalPoints > 100) {
    return c.json({ success: false, error: '合計ポイントが100を超えています' }, 400)
  }

  // 参加者取得または作成
  let participant = await db.prepare(
    'SELECT * FROM participants WHERE name = ?'
  ).bind(participant_name).first<{ id: number; name: string; initial_points: number }>()

  if (!participant) {
    const created = await db.prepare(
      'INSERT INTO participants (name) VALUES (?) RETURNING *'
    ).bind(participant_name).first<{ id: number; name: string; initial_points: number }>()
    participant = created!
  }

  // 既存の賭けを削除して再設定
  await db.prepare('DELETE FROM bets WHERE participant_id = ?').bind(participant.id).run()

  // 新しい賭けを挿入
  for (const bet of betList) {
    if (bet.points > 0) {
      await db.prepare(`
        INSERT INTO bets (participant_id, country_id, points)
        VALUES (?, ?, ?)
      `).bind(participant.id, bet.country_id, bet.points).run()
    }
  }

  return c.json({ success: true, participant_id: participant.id })
})

// Google Forms 回答を一括インポート
bets.post('/import', async (c) => {
  const db = c.env.DB
  const body = await c.req.json<{
    rows: {
      name: string
      bets: { country_code: string; points: number }[]
    }[]
  }>()

  const results = []
  const errors = []

  for (const row of body.rows) {
    try {
      // 参加者取得または作成
      let participant = await db.prepare(
        'SELECT * FROM participants WHERE name = ?'
      ).bind(row.name).first<{ id: number }>()

      if (!participant) {
        const created = await db.prepare(
          'INSERT INTO participants (name) VALUES (?) RETURNING *'
        ).bind(row.name).first<{ id: number }>()
        participant = created!
      }

      // 合計ポイントチェック
      const totalPoints = row.bets.reduce((sum, b) => sum + b.points, 0)
      if (totalPoints > 100) {
        errors.push({ name: row.name, error: '合計ポイントが100超' })
        continue
      }

      // 既存の賭けを削除して再設定
      await db.prepare('DELETE FROM bets WHERE participant_id = ?').bind(participant.id).run()

      for (const bet of row.bets) {
        if (bet.points > 0) {
          const country = await db.prepare(
            'SELECT id FROM countries WHERE code = ?'
          ).bind(bet.country_code).first<{ id: number }>()

          if (country) {
            await db.prepare(`
              INSERT INTO bets (participant_id, country_id, points)
              VALUES (?, ?, ?)
            `).bind(participant.id, country.id, bet.points).run()
          }
        }
      }

      results.push({ name: row.name, success: true })
    } catch (e: any) {
      errors.push({ name: row.name, error: e.message })
    }
  }

  // 同期ログを記録
  await db.prepare(`
    INSERT INTO sync_logs (rows_processed, status, message)
    VALUES (?, ?, ?)
  `).bind(results.length, errors.length > 0 ? 'partial' : 'success',
    `成功: ${results.length}, エラー: ${errors.length}`).run()

  return c.json({ success: true, results, errors })
})

export default bets
