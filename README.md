# Smart Business OS - Admin Dashboard

- **Frontend**: React + Vite (JavaScript), Tailwind CSS, React Router, Recharts, lucide-react.
- **Backend**: Java 17+ / Spring Boot 3 (`backend/`), REST API under `/api`.
- **Database**: Supabase Postgres, schema created by Flyway.

```
browser  ->  Vite dev server (:5173)  --/api proxy-->  Spring Boot (:8080)  --JDBC-->  Supabase Postgres (schema os + website users)
```

## Sign in

The OS has no accounts of its own. It signs in against the website's `users` table (`public.users` in the Geethu's Corner Supabase project): the same email and password, and the user's `role` must be `ADMIN`. To give someone access, set their role to `ADMIN` in Supabase; to remove access, set it back to `CUSTOMER`. Accounts are created and passwords changed on the website only. The phone app will use the same login.

- Every `/api` call needs the token, and the token's user must still be an admin in that table at that moment. Only `POST /api/auth/login` is public.
- The backend refuses to start without `JWT_SECRET` (32+ random characters; the generator command is in `backend/.env.example`), so the API can never run open by accident.
- A sign-in lasts `AUTH_TOKEN_DAYS` days (default 7) and survives closing the browser. **Sign out** ends it earlier.
- 5 wrong passwords from one address block that address for 15 minutes.

## Run it

### 1. Settings

Supabase dashboard > Connect > **Session pooler** (port 5432), using the Geethu's Corner project. Then:

```bash
cd backend
cp .env.example .env      # fill in DB_URL, DB_USERNAME, DB_PASSWORD and JWT_SECRET
```

`.env` is git-ignored. Use plain `KEY=value` lines with no quotes. No admin login goes in `.env`.

### 2. Backend

```bash
cd backend
./mvnw spring-boot:run        # Windows: mvnw.cmd spring-boot:run
```

On first start Flyway creates the tables (`backend/src/main/resources/db/migration/V1__init.sql`). Check it with http://localhost:8080/api/products (an empty list `[]` is correct).

### 3. Frontend

```bash
npm install
npm run dev                   # http://localhost:5173
npm run build                 # production build into dist/
```

In development Vite forwards `/api` to `http://localhost:8080`. For a deployed frontend set `VITE_API_URL` (see `.env.example`) and `CORS_ORIGINS` in the backend.

### The database

The OS and the website share one Supabase database. The OS keeps its own tables in a separate schema called `os` (created on the first start), so it never touches the website's tables in `public`. The only website table it reads is `users`, and it never writes to it. Use the **session pooler** (port 5432) as `DB_URL=jdbc:postgresql://<host>:5432/postgres`; Flyway migrations need session features, so avoid the transaction pooler (6543).

## Deploy the backend to Render

1. Push this repo to GitHub.
2. In Render: **New > Blueprint**, pick the repo. `render.yaml` creates the `smart-business-os-api` web service (Docker, `backend/` folder, health check `/api/health`).
3. Fill the secret values Render asks for: `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, and `CORS_ORIGINS` (the deployed OS website address).
4. Use the service address as `VITE_API_URL` (OS website) and `EXPO_PUBLIC_API_URL` (`mobile/eas.json`), both ending in `/api`.

The free plan sleeps after ~15 minutes without traffic and needs up to a minute to wake. The OS website and the app handle this: they ping `/api/health` early, retry while the server starts (502/503/504) for about 90 seconds, and show a "waking up" message instead of an error. Saving a sale is only retried when the server never received it, so a sale is never saved twice.



```
src/                              frontend
  api/client.js                   fetch wrapper (base URL, JSON, error messages)
  api/<entity>.js                 products, purchases, customers, sales, sellers: one line each
  context/DataContext.jsx         loads everything, holds it in state, shows server errors as a toast
  pages/ components/ utils/       UI
backend/
  src/main/java/com/smartbusiness/os/
    model/                        JPA entities (Product, Seller, Customer, Purchase, Sale + line items)
    repo/Repositories.java        Spring Data repositories
    service/                      PurchaseService, SaleService (invoice numbers, totals)
    web/                          REST controllers, error handler ({"message": "..."})
  src/main/resources/db/migration Flyway SQL
  src/test/                       API flow test on in-memory H2 (./mvnw test)
```

## API

| Resource | Endpoints |
| --- | --- |
| `/api/products`, `/api/sellers`, `/api/customers` | `GET`, `GET /{id}`, `POST`, `PATCH /{id}` (partial update), `DELETE /{id}` |
| `/api/purchases`, `/api/sales` | `GET`, `GET /{id}`, `POST`, `DELETE /{id}` |

Rules enforced by the server:
- **Purchase**: subtotal, tax and total are recalculated. An unknown product rejects the whole purchase.
- **Sale**: totals are recalculated and the invoice number (`INV-<year>-0001`) is assigned by the server.
- **Product**: name, type, prices and unit. There is no stock tracking.
- Errors are returned as `{"message": "..."}` with 400 / 404 / 409.

## Behaviour summary

- **Products**: Add Products page manages the catalogue (name, type, prices, unit). Selling and Purchase Products pages are view-only.
- **Purchases**: pick or create a seller and products inline; tax defaults to 0%.
- **Customers / Sellers**: add and edit, with purchase and sales history.
- **Sales**: pick or create a customer and products inline; printable invoice page.
- **Overview**: totals, sales vs purchases chart, top products, profit by selling product (selling price minus cost price), recent activity.
