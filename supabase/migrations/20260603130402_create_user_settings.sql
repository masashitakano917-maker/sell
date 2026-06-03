/*
  # ユーザー設定テーブルの作成

  1. 新規テーブル
    - `user_settings`
      - `user_id` (uuid, PK / auth.users 参照)
      - `target_profit` (integer) — AI判定で使う「目標粗利（円）」。デフォルト 2500。
      - `updated_at` (timestamptz)

  2. セキュリティ
    - RLS 有効化
    - 自分の行のみ select / insert / update / delete 可能。
*/

CREATE TABLE IF NOT EXISTS user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  target_profit integer NOT NULL DEFAULT 2500,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own settings"
  ON user_settings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);