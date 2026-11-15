import { Router } from "express";
import bcrypt from "bcryptjs";
import { getCollections } from "../db.js";
import {
  AUTH_COOKIE,
  clearAuthCookie,
  publicUser,
  requireAuth,
  setAuthCookie,
  signToken,
} from "../lib/auth.js";
import { asyncHandler, httpError } from "../lib/http.js";
import {
  optionalString,
  requireEmail,
  requireString,
  trimString,
  validatePassword,
} from "../lib/validate.js";

const router = Router();

const avatarFor = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "Studio User"
  )}&background=0f172a&color=ffffff&size=256`;

/** POST /api/auth/register */
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const name = requireString(body.name, "Name", { min: 2, max: 80 });
    const email = requireEmail(body.email);
    const password = validatePassword(body.password);
    const photoURL = optionalString(body.photoURL, "Photo URL", { max: 500 });
    if (photoURL) {
      try {
        const parsed = new URL(photoURL);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("bad");
      } catch {
        throw httpError(400, "Photo URL must be a valid http(s) link.");
      }
    }

    const { users } = await getCollections();
    const existing = await users.findOne({ email });
    if (existing) {
      throw httpError(409, "An account with this email already exists. Try signing in.");
    }

    const now = new Date();
    const document = {
      name,
      email,
      photoURL: photoURL || avatarFor(name),
      password: await bcrypt.hash(password, 10),
      provider: "credentials",
      createdAt: now,
      updatedAt: now,
    };

    const result = await users.insertOne(document);
    res.status(201).json({
      success: true,
      message: "Account created successfully. Please sign in to continue.",
      data: publicUser({ ...document, _id: result.insertedId }),
    });
  })
);

/** POST /api/auth/login */
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const email = requireEmail(body.email);
    const password = typeof body.password === "string" ? body.password : "";
    if (!password) throw httpError(400, "Password is required.");

    const { users } = await getCollections();
    const user = await users.findOne({ email });

    if (!user) throw httpError(401, "No account found with this email address.");
    if (!user.password) {
      throw httpError(400, "This account was created with Google. Please use Google sign-in.");
    }

    const matches = await bcrypt.compare(password, user.password);
    if (!matches) throw httpError(401, "Incorrect password. Please try again.");

    const token = signToken(user);
    setAuthCookie(res, token);

    res.json({
      success: true,
      message: `Welcome back, ${user.name.split(" ")[0]}!`,
      data: { user: publicUser(user) },
    });
  })
);

/**
 * POST /api/auth/google
 * Accepts the credential (ID token) returned by Google Identity Services.
 * The token is verified against Google, then the user is upserted.
 */
router.post(
  "/google",
  asyncHandler(async (req, res) => {
    const credential = trimString(req.body?.credential || req.body?.idToken);
    if (!credential) throw httpError(400, "Missing Google credential.");

    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );
    if (!response.ok) {
      throw httpError(401, "Google sign-in failed. Please try again.");
    }
    const profile = await response.json();

    if (process.env.GOOGLE_CLIENT_ID && profile.aud !== process.env.GOOGLE_CLIENT_ID) {
      throw httpError(401, "Google token audience mismatch.");
    }
    if (!profile.email || profile.email_verified === "false") {
      throw httpError(401, "Your Google email is not verified.");
    }

    const email = String(profile.email).toLowerCase();
    const { users } = await getCollections();
    const now = new Date();
    const name = profile.name || email.split("@")[0];
    const photoURL = profile.picture || avatarFor(name);

    const user = await users.findOneAndUpdate(
      { email },
      {
        $set: { name, photoURL, provider: "google", lastLoginAt: now, updatedAt: now },
        $setOnInsert: { email, createdAt: now },
      },
      { upsert: true, returnDocument: "after" }
    );

    const document = user?.value || user;
    setAuthCookie(res, signToken(document));

    res.json({
      success: true,
      message: `Signed in with Google as ${name}.`,
      data: { user: publicUser(document) },
    });
  })
);

/** POST /api/auth/logout */
router.post("/logout", (req, res) => {
  clearAuthCookie(res);
  res.json({ success: true, message: "You have been signed out.", data: null });
});

/** GET /api/auth/me – used on reload so private routes are never lost. */
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { users } = await getCollections();
    const user = await users.findOne({ email: req.user.email });
    if (!user) {
      clearAuthCookie(res);
      throw httpError(401, "Your account no longer exists.");
    }
    res.json({ success: true, data: { user: publicUser(user) } });
  })
);

/** GET /api/auth/check – non-blocking session probe. */
router.get("/check", (req, res) => {
  res.json({ success: true, data: { authenticated: Boolean(req.cookies?.[AUTH_COOKIE]) } });
});

export default router;
