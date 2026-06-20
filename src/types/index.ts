export type Bindings = {
  DB: D1Database
  ADMIN_PASSWORD: string
  GOOGLE_SHEETS_API_KEY: string
  GOOGLE_SPREADSHEET_ID: string
}

export type Country = {
  id: number
  name: string
  name_ja: string
  code: string
  group_name: string | null
  flag_emoji: string | null
  eliminated: number
  eliminated_round: string | null
  is_winner: number
}

export type Participant = {
  id: number
  name: string
  initial_points: number
  created_at: string
}

export type Bet = {
  id: number
  participant_id: number
  country_id: number
  points: number
}

export type BetWithDetails = Bet & {
  participant_name: string
  country_name: string
  country_name_ja: string
  country_code: string
  flag_emoji: string | null
}

export type OddsData = {
  country_id: number
  country_name: string
  country_name_ja: string
  country_code: string
  flag_emoji: string | null
  group_name: string | null
  total_bet_points: number
  odds: number
  eliminated: number
  is_winner: number
}

export type ParticipantRanking = {
  rank: number
  participant_id: number
  name: string
  initial_points: number
  total_bet_points: number
  remaining_points: number
  payout: number
  net_gain: number
  current_points: number
}
