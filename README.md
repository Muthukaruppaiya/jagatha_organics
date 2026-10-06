# jagatha_organics

Shop and order desk for Jagatha Organics: a React storefront, an Express API, and a local Postgres database.

## Run locally

```bash
npm install
npm install --prefix server
npm install --prefix client
copy server\.env.example server\.env
npm run dev
```

The API starts its own Postgres the first time it runs. Set a long `JWT_SECRET` in `server/.env` before you deploy. Do not commit `server/.env`.
