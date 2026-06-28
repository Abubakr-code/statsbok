# StatBooks deploy

## 1. Secretlarni almashtirish

Oldin `.env` GitHubga chiqqan bo‘lsa, quyidagilarni yangilang:

- MongoDB Atlas user password
- `JWT_SECRET`
- `GOOGLE_BOOKS_API_KEY`
- `OPENROUTER_API_KEY`
- `RESEND_API_KEY`

Yangi qiymatlarni GitHubga push qilmang. Ularni faqat hosting dashboardidagi Environment Variables bo‘limiga kiriting.

## 2. Backend: Render free

1. Render.com hisob oching.
2. GitHub repository ulang.
3. `render.yaml` blueprint sifatida deploy qiling yoki manual web service yarating.
4. Environment variables:
   - `NODE_ENV=production`
   - `PORT=10000`
   - `FRONTEND_URL=https://<frontend-domain>`
   - `MONGODB_URI=...`
   - `JWT_SECRET=...`
   - `JWT_EXPIRES_IN=7d`
   - `GOOGLE_BOOKS_API_KEY=...`
   - `GOOGLE_CLIENT_ID=...`
   - `GOOGLE_CLIENT_SECRET=...`
   - `OPENROUTER_API_KEY=...`
   - `OPENROUTER_MODEL=openai/gpt-oss-120b:free`
   - `OPENROUTER_SEARCH_API_KEY=...` (ixtiyoriy, bo'sh bo'lsa umumiy key ishlatiladi)
   - `OPENROUTER_SEARCH_MODEL=google/gemini-2.5-flash`
   - `OPENROUTER_CHAT_API_KEY=...` (ixtiyoriy, bo'sh bo'lsa umumiy key ishlatiladi)
   - `OPENROUTER_CHAT_MODEL=openai/gpt-4.1-mini`
   - `RESEND_API_KEY=...`
   - `EMAIL_FROM=StatBooks <onboarding@resend.dev>`
   - `ALLOW_EMAIL_DEV_FALLBACK=false` (kod terminalga chiqmasligi uchun)
   - `AUTH_CODE_TEST_INBOX=you@gmail.com` (ixtiyoriy: testda barcha kodlar shu inboxga boradi)

Render backend URL misol: `https://statbooks-backend.onrender.com`.

## 2.1 Google OAuth Consent Screen

Google Cloud Console ichida:

1. OAuth consent screen’da App name va support emailni to‘ldiring.
2. `Authorized domains`ga frontend domeningizni qo‘shing (masalan `netlify.app` yoki o‘z domeningiz).
3. OAuth client (Web application) ichida:
   - `Authorized JavaScript origins`: frontend URL
   - `Authorized redirect URIs`: agar alohida callback ishlatsangiz URL kiriting
4. Shu client ID/secret qiymatlarini backend env (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)ga yozing.

## 3. Frontend: Netlify free

1. Netlify.com hisob oching.
2. Repository ulang.
3. Base directory: `frontend`
4. Build command: `npm ci && npm run build`
5. Publish directory: `frontend/dist`
6. `frontend/netlify.toml` ichidagi backend URLni Render bergan URLga moslang.

Netlify bepul domain beradi: `https://<site-name>.netlify.app`.

## 4. Deploydan keyingi test

- `https://<backend>/api/health`
- Frontend qidiruv
- Login/register email code
- AI yordamchi
- `https://<frontend>/phpadminpanel` 404 bo‘lishi
- `https://<backend>/api/db` 404 bo‘lishi
