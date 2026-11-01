# Smart Business OS - Admin Dashboard

- **Frontend**: React + Vite (JavaScript), Tailwind CSS, React Router, Recharts, lucide-react.
- **Backend**: Java 17+ / Spring Boot 3 (`backend/`), REST API under `/api`.
- **Database**: Supabase Postgres, schema created by Flyway.

```
browser  ->  Vite dev server (:5173)  --/api proxy-->  Spring Boot (:8080)  --JDBC-->  Supabase Postgres
```

There is no login yet: anyone who can reach the backend can read and change the data. Add authentication before exposing it publicly.

## Run it

### 1. Database credentials

Supabase dashboard > Connect > **Session pooler** (port 5432). Then:

```bash
cd backend
cp .env.example .env      # set DB_PASSWORD (and DB_USER / DB_HOST if they differ)
```

`.env` is git-ignored. Use plain `KEY=value` lines with no quotes. A password with special characters needs no URL-encoding here because the host, user and password are separate settings.

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

### Which Supabase connection string?

| Port | Mode | Use it for |
| --- | --- | --- |
| 5432 | session pooler | **This app** (migrations and queries) |
| 6543 | transaction pooler | Works for queries (`prepareThreshold=0` is already set) but Flyway migrations should use 5432 |

The `postgresql://...?pgbouncer=true` form from Prisma-style `.env` files is not a JDBC URL, so the backend takes `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` instead.

## Structure

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
