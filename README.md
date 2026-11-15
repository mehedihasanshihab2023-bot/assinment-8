# StudioSpace API

Peer-to-peer creative workspace and production studio sharing platform — REST API built with **Express 5**, **MongoDB** and **JWT (HTTPOnly cookie)** authentication.

StudioSpace lets studio owners list photography cyc walls, sound stages, podcast lounges, music suites and workshops, while creators discover, filter, check availability and reserve hourly slots with transparent pricing.

- **Client repo:** `https://github.com/<your-username>/studiospace-client`
- **Live API:** `https://studiospace-server.vercel.app` _(`/api` lists every endpoint)_
- **Live site:** `https://studiospace-client.vercel.app`

---

## Features

- **JWT auth with HTTPOnly cookies** — register, login, Google sign-in, logout and `GET /api/auth/me` for reload-safe private routes. The token is never exposed to client JavaScript.
- **Full studio CRUD** — create, read, filter, update and delete listings; owner identity (`ownerEmail` / `ownerName`) is always taken from the verified JWT, never from the request body.
- **Double-booking protection** — overlapping slots are rejected with `409 Conflict` using MongoDB range queries (`startTime < requestedEnd && endTime > requestedStart`) against Pending/Confirmed bookings.
- **Booking lifecycle** — `Pending → Confirmed → Completed` plus guest/host cancellation, per-day availability lookup and host-side status management.
- **Wishlist, reviews and ratings** — saved studios per user with a unique compound index, one review per creator per studio, and aggregated `rating` / `reviewCount` recalculated with an `$avg` aggregation pipeline.
- **Paginated search API** — text search, category, location, price range, capacity and six sort modes with `page` / `limit` metadata.
- **Branded-ready metadata** — `/api/meta/categories` (live counts), `/api/meta/stats` (home page trust strip) and `/api/meta/upload` (optional imgbb proxy so the API key stays server-side).
- **Serverless-first** — MongoDB connection and index creation are cached per Vercel instance, and `api/index.js` exposes the Express app as a single serverless function.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Runtime | Node.js 18+ (ES Modules) |
| Server | Express 5 |
| Database | MongoDB Atlas (`mongodb` driver, no ODM) |
| Auth | `jsonwebtoken` + `bcryptjs`, HTTPOnly cookie (`studiospace_token`) |
| Hosting | Vercel (serverless function, `api/index.js`) |
| Validation | Hand-rolled validators in `src/lib/validate.js` |

---

## Getting started locally

```bash
# 1. install dependencies
npm install

# 2. create the env file
cp .env.example .env      # Windows: copy .env.example .env

# 3. fill in MONGODB_URI, JWT_SECRET and CLIENT_URLS (see below)

# 4. seed demo hosts, studios, bookings and reviews
npm run seed              # add --reset to wipe studios/bookings/reviews first

# 5. run the API on http://localhost:8000
npm run dev
```

### Environment variables

| Key | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | yes | MongoDB Atlas connection string |
| `DB_NAME` | no | Database name (default `studiospace`) |
| `JWT_SECRET` | yes in production | Signing secret (`openssl rand -base64 48`) |
| `JWT_EXPIRES_IN` | no | Token lifetime (default `7d`) |
| `CLIENT_URLS` | yes for browser use | Comma separated client origins allowed by CORS |
| `GOOGLE_CLIENT_ID` | no | Required only to verify Google ID token audiences |
| `IMGBB_API_KEY` | no | Enables `POST /api/meta/upload` |
| `NODE_ENV` | no | `development` locally, set automatically on Vercel |

### Examiner test credentials

| Role | Email | Password |
| --- | --- | --- |
| Creator (books studios) | `creator@studiospace.com` | `Creator123` |
| Studio host (owns listings) | `host@studiospace.com` | `Host1234` |
| Second host | `studio@studiospace.com` | `Studio123` |

---

## API reference

All responses use a `{ success, message?, data?, pagination? }` envelope. Errors return `{ success: false, message }` with the matching HTTP status.

### Auth — `/api/auth`

| Method | Route | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/register` | – | `name, email, photoURL?, password`; password needs 6+ chars, one uppercase, one lowercase |
| POST | `/login` | – | Sets `studiospace_token` HTTPOnly cookie |
| POST | `/google` | – | Body `{ credential }` from Google Identity Services |
| POST | `/logout` | – | Clears the cookie |
| GET | `/me` | cookie | Returns the signed-in user (safe for reloads) |
| GET | `/check` | – | `{ authenticated: boolean }` |

### Studios — `/api/studios`

| Method | Route | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/` | – | `search, category, location, minPrice, maxPrice, minCapacity, sort, page, limit` |
| GET | `/featured` | – | 6 top-rated / newest studios for the home page |
| GET | `/my-listings` | cookie | Only the signed-in owner's studios |
| GET | `/:id` | optional | Studio + latest reviews + `isWishlisted` |
| GET | `/:id/availability?date=YYYY-MM-DD` | – | Booked slots for that day |
| POST | `/` | **cookie** | Rejects with `401` without a valid cookie |
| PUT/PATCH | `/:id` | **cookie** | Owner only (`403` otherwise) |
| DELETE | `/:id` | **cookie** | Owner only, also cleans wishlists/reviews |

`category` must be one of: `Photo Studio`, `Film Stage`, `Podcast Lounge`, `Music Suite`, `Workshop`.

### Bookings — `/api/bookings`

| Method | Route | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/` | **cookie** | `studioId, date, startTime, endTime, guests?, note?`; status starts as `Pending` |
| GET | `/my-bookings` | cookie | Reservations made by the signed-in creator |
| GET | `/received` | cookie | Reservations on studios owned by the signed-in host |
| PATCH | `/:id/cancel` | cookie | Guests cancel Pending; hosts can also cancel Confirmed |
| PATCH | `/:id/status` | cookie | Host only: `Confirmed`, `Completed`, `Cancelled` |

### Wishlist, reviews, meta

| Method | Route | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/api/wishlist` | cookie | Saved studios (full documents) |
| GET | `/api/wishlist/ids` | cookie | Studio ids only, for card hearts |
| POST / DELETE | `/api/wishlist/:studioId` | cookie | Save / remove |
| GET | `/api/studios/:studioId/reviews` | – | Latest 50 reviews |
| POST | `/api/studios/:studioId/reviews` | cookie | `{ rating: 1-5, comment }`, one per user per studio |
| GET | `/api/meta/categories` | – | Category cards + counts |
| GET | `/api/meta/stats` | – | Studios, hosts, bookings, average rating |
| POST | `/api/meta/upload` | – | imgbb proxy (`IMGBB_API_KEY` required) |
| GET | `/api/health` | – | Uptime probe |

---

## Security & challenge implementations

1. **HTTPOnly cookie JWT (Challenge 1).** `POST /api/auth/login` signs a JWT and stores it in a `HttpOnly; Secure; SameSite=None` cookie in production (`SameSite=Lax` on localhost). `POST /api/studios`, `PUT/PATCH/DELETE /api/studios/:id`, `POST /api/bookings` and every wishlist/review mutation require that cookie and answer `401 Unauthorized` otherwise. Ownership checks are enforced server-side, so `ownerEmail` can never be spoofed.
2. **Overlap-safe booking engine (Challenge 2).** Before insert, the API queries `status ∈ {Pending, Confirmed}` with the half-open interval test `startTime < end && endTime > start`. Touching slots (`13:00–15:00` after `10:00–13:00`) are allowed, real overlaps return a descriptive `409`. Confirming a pending booking re-runs the same check so two pendings can never both become confirmed.
3. **Theme system (Challenge 3).** Client-side responsibility; the API is theme-agnostic and works the same in light and dark mode.
4. **Extras.** Passwords hashed with bcrypt, password policy enforced on the server, JWT expiry, CORS allow-list with credentials, Mongo indexes (unique email, unique `userEmail + studioId`, compound booking indexes), and `safe` public user serialisation that never returns the password hash.

---

## Deploying to Vercel

The repository is already serverless-ready:

- `api/index.js` exports the Express app as the single Vercel function.
- `vercel.json` rewrites every path to that function so Express keeps receiving the original URL (e.g. `/api/studios/123`).
- The Mongo client + index creation are cached in module scope for warm invocations.

```bash
# one-off deploy from this folder
npx vercel --prod

# or connect the GitHub repo in the Vercel dashboard (Framework preset: Other, leave build command empty)
```

Add these **Environment Variables** in the Vercel project before the first deploy:

```
MONGODB_URI   = mongodb+srv://...
DB_NAME       = studiospace
JWT_SECRET    = <48+ random characters>
CLIENT_URLS   = https://your-client.vercel.app,http://localhost:3000
GOOGLE_CLIENT_ID = (optional)
IMGBB_API_KEY    = (optional)
```

After deploying, verify `https://<your-project>.vercel.app/api/health` returns `{ "status": "ok" }`, then point the client's API base URL at it and send requests with `credentials: "include"`.

> MongoDB Atlas: add `0.0.0.0/0` (or Vercel's egress ranges) to the cluster IP access list so serverless functions can connect.

---

## Project structure

```
api/index.js              Vercel serverless entry (default-exports the Express app)
index.js                  Local listener (npm run dev)
src/app.js                Express app: CORS, JSON, cookies, routes, errors
src/db.js                 Cached MongoDB connection + index creation
src/lib/auth.js           JWT sign/verify, HTTPOnly cookie helpers, guards
src/lib/validate.js       Request validators (password policy, dates, times, ids)
src/lib/constants.js      Studio categories, booking statuses, category presets
src/routes/auth.routes.js     register / login / google / logout / me
src/routes/studio.routes.js   list, featured, my-listings, details, availability, CRUD
src/routes/booking.routes.js  create, my-bookings, received, cancel, status
src/routes/wishlist.routes.js saved studios
src/routes/review.routes.js   reviews + rating aggregation
src/routes/meta.routes.js     categories, stats, imgbb upload
src/middleware/error.js   404 + centralised error handler (409 on duplicate keys)
scripts/seed.js           Demo users, 10 studios, bookings, reviews
scripts/smoke-test.js     25 end-to-end API checks
```

---

## Testing

```bash
npm start            # terminal 1
npm run test:api     # terminal 2 - 25 checks across auth, CRUD, bookings, wishlist
```

The smoke test verifies the `401` protection, password policy, owner-only updates, overlap rejection (`409`), back-to-back slot acceptance, cancellation and wishlist flows, then removes everything it created.

---

© 2026 StudioSpace. Built for creators, by creators.
