import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { ensureIndexes } from "./db.js";
import authRoutes from "./routes/auth.routes.js";
import studioRoutes from "./routes/studio.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import wishlistRoutes from "./routes/wishlist.routes.js";
import reviewRoutes from "./routes/review.routes.js";
import metaRoutes from "./routes/meta.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";

const DEFAULT_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
];

function allowedOrigins() {
  const configured = (process.env.CLIENT_URLS || process.env.CLIENT_URL || "")
    .split(",")
    .map((item) => item.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return [...new Set([...configured, ...DEFAULT_ORIGINS])];
}

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const clean = origin.replace(/\/$/, "");
      const list = allowedOrigins();
      // Allow the configured client URLs plus Vercel preview deployments.
      if (list.includes(clean) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(clean)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: true, limit: "8mb" }));
app.use(cookieParser());

app.get("/", (req, res) => {
  res.json({
    success: true,
    name: "StudioSpace API",
    version: "1.0.0",
    message: "Peer-to-peer creative workspace booking API.",
    docs: "/api",
    ...(process.env.NODE_ENV === "production" ? {} : { uptime: process.uptime() }),
  });
});

app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "StudioSpace API v1",
    auth: {
      register: "POST /api/auth/register",
      login: "POST /api/auth/login",
      google: "POST /api/auth/google",
      logout: "POST /api/auth/logout",
      me: "GET /api/auth/me",
    },
    studios: {
      list: "GET /api/studios",
      featured: "GET /api/studios/featured",
      details: "GET /api/studios/:id",
      availability: "GET /api/studios/:id/availability?date=YYYY-MM-DD",
      myListings: "GET /api/studios/my-listings",
      create: "POST /api/studios",
      update: "PUT /api/studios/:id",
      remove: "DELETE /api/studios/:id",
    },
    bookings: {
      create: "POST /api/bookings",
      mine: "GET /api/bookings/my-bookings",
      received: "GET /api/bookings/received",
      cancel: "PATCH /api/bookings/:id/cancel",
      status: "PATCH /api/bookings/:id/status",
    },
    wishlist: {
      list: "GET /api/wishlist",
      ids: "GET /api/wishlist/ids",
      save: "POST /api/wishlist/:studioId",
      remove: "DELETE /api/wishlist/:studioId",
    },
    reviews: {
      list: "GET /api/studios/:studioId/reviews",
      create: "POST /api/studios/:studioId/reviews",
    },
    meta: {
      categories: "GET /api/meta/categories",
      stats: "GET /api/meta/stats",
      upload: "POST /api/meta/upload",
      health: "GET /api/health",
    },
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "ok",
    service: "studiospace-api",
    timestamp: new Date().toISOString(),
  });
});

// Warm the connection + indexes once per serverless instance.
app.use(async (req, res, next) => {
  try {
    await ensureIndexes();
    next();
  } catch (error) {
    next(error);
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/studios/:studioId/reviews", reviewRoutes);
app.use("/api/studios", studioRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/meta", metaRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
