import jwt from "jsonwebtoken";
import { httpError } from "./http.js";

export const AUTH_COOKIE = "studiospace_token";
const TOKEN_TTL = process.env.JWT_EXPIRES_IN || "7d";

const secret = () => {
  const value = process.env.JWT_SECRET;
  if (!value) {
    if (process.env.NODE_ENV === "production") {
      throw Object.assign(
        new Error("JWT_SECRET is missing. Add it to the Vercel environment variables."),
        { status: 500 }
      );
    }
    return "studiospace-local-development-secret";
  }
  return value;
};

export function signToken(user) {
  return jwt.sign(
    {
      sub: String(user._id),
      email: user.email,
      name: user.name,
      photo: user.photoURL || "",
    },
    secret(),
    { expiresIn: TOKEN_TTL }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, secret());
}

const isProduction = () => process.env.NODE_ENV === "production";

/**
 * Challenge 1: the JWT lives in an HTTPOnly cookie so client JavaScript can
 * never read it. SameSite=None + Secure is required for cross-site
 * deployments (Next.js on Vercel calling this API on another domain).
 */
export function authCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: isProduction() ? "none" : "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

export function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE, token, authCookieOptions());
}

export function clearAuthCookie(res) {
  const { maxAge, ...options } = authCookieOptions();
  res.clearCookie(AUTH_COOKIE, options);
}

function readToken(req) {
  const cookieToken = req.cookies?.[AUTH_COOKIE];
  if (cookieToken) return cookieToken;
  const header = req.headers.authorization || "";
  if (header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  return "";
}

/** Rejects the request with 401 when the HTTPOnly JWT cookie is missing/invalid. */
export function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) {
    return next(httpError(401, "You must be signed in to perform this action."));
  }
  try {
    const payload = verifyToken(token);
    req.user = {
      id: payload.sub,
      email: String(payload.email || "").toLowerCase(),
      name: payload.name || "",
      photo: payload.photo || "",
    };
    return next();
  } catch {
    return next(httpError(401, "Your session has expired. Please sign in again."));
  }
}

/** Attaches req.user when a valid cookie exists but never blocks the request. */
export function optionalAuth(req, res, next) {
  const token = readToken(req);
  if (!token) return next();
  try {
    const payload = verifyToken(token);
    req.user = {
      id: payload.sub,
      email: String(payload.email || "").toLowerCase(),
      name: payload.name || "",
      photo: payload.photo || "",
    };
  } catch {
    req.user = undefined;
  }
  return next();
}

/** Public shape of a user document – never leaks the password hash. */
export function publicUser(user) {
  if (!user) return null;
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    photoURL: user.photoURL || "",
    provider: user.provider || "credentials",
    createdAt: user.createdAt || null,
  };
}
