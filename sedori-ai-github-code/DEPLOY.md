# GitHub → Cloudflare Pages 手順

## 1. GitHubにpush

```bash
git init
git add .
git commit -m "Initial sedori AI judge app"
git branch -M main
git remote add origin https://github.com/<YOUR_NAME>/<REPO_NAME>.git
git push -u origin main
```

## 2. Cloudflare Pagesで接続

- Cloudflare Dashboard → Workers & Pages → Create application → Pages
- Connect to Git
- 対象リポジトリを選択
- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`

## 3. ローカル確認

```bash
npm install
npm run dev
```

## 4. 今後AI画像判定を入れる場合

APIキーはフロント側に置かないでください。  
Cloudflare Pages Functions または Workers の環境変数に入れて、`functions/api/judge.ts` から呼び出します。
