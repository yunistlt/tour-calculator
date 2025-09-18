# Калькулятор туров (Netlify + Supabase)

## Развёртывание на Netlify
1. Создайте проект в Supabase, выполните SQL из `supabase/schema.sql`.
2. В Netlify → Site settings → Environment variables добавьте:
   - `SUPABASE_URL` — URL вашего проекта
   - `SUPABASE_SERVICE_KEY` — Service role key (секретно)
   - `JWT_SECRET` — любой длинный секрет
   - `ADMIN_USERNAME` — **yunistlt**
   - `ADMIN_PASSWORD` — **otnafrnehf**
3. Подключите репозиторий и деплойте. Build command: `npm run build`. Publish dir: `dist`.
4. После деплоя доступно:
   - Пользовательский вход: `/login`
   - Админ вход: `/admin/login`
   - Калькулятор: `/` (требует токен пользователя)
   - Админ‑панель: `/admin` (требует токен админа)

## Локально
```bash
npm i
# Запуск локально с функциями
npx netlify dev
```
