# Sedori AI Judge

店舗せどり用の仕入れ判定アプリ MVP です。  
`src/data/master.json` に v4 マスターを内蔵し、ブランド・服種類・仕入れ値・状態・素材などから「買い / 条件付き / 慎重 / 見送り」を判定します。

## ローカル起動

```bash
npm install
npm run dev
```

## Cloudflare Pages デプロイ

1. GitHub にこのフォルダを push
2. Cloudflare Pages で GitHub repo を接続
3. Framework preset: `Vite`
4. Build command: `npm run build`
5. Build output directory: `dist`
6. Deploy

## データ更新

`src/data/master.json` を差し替えれば、判定マスターを更新できます。  
元TSVは `public/sedori_ai_guideline_master_v4_master.tsv` に入っています。

## 重要

これはルールベース判定のMVPです。画像はアップロードできますが、現時点では自動画像解析までは行いません。  
次段階で Cloudflare Pages Functions / Workers 経由で画像AIや相場検索APIを接続してください。
