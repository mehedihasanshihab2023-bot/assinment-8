/**
 * End-to-end smoke test against a running StudioSpace API.
 *
 *   npm start            (in another terminal)
 *   npm run test:api
 *
 * Covers: auth, 401 protection, studio CRUD, double-booking prevention,
 * cancellation, wishlist and reviews. Created documents are removed at the end.
 */
import "dotenv/config";
import { ObjectId } from "mongodb";
import { getDB } from "../src/db.js";

const BASE = process.env.API_URL || "http://localhost:8000";
const EMAIL = "creator@studiospace.com";
const PASSWORD = "Creator123";

let cookie = "";
let passed = 0;
let failed = 0;
const created = { studioId: null, bookingIds: [], reviewId: null };

function check(name, condition, extra = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${name}${extra ? ` -> ${extra}` : ""}`);
  }
}

async function api(path, { method = "GET", body, withCookie = true } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(withCookie && cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const setCookie = response.headers.getSetCookie?.() || [];
  const authCookie = setCookie.find((item) => item.startsWith("studiospace_token="));
  if (authCookie) cookie = authCookie.split(";")[0];

  const text = await response.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { status: response.status, body: json };
}

const tomorrow = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
};

async function cleanup(studioId) {
  const db = await getDB();
  if (studioId) await db.collection("studios").deleteOne({ _id: studioId });
  if (created.bookingIds.length) {
    await db.collection("bookings").deleteMany({ _id: { $in: created.bookingIds } });
  }
  if (created.reviewId) await db.collection("reviews").deleteOne({ _id: created.reviewId });
  await db.collection("wishlists").deleteMany({ userEmail: EMAIL });
}

async function main() {
  console.log(`\nStudioSpace API smoke test -> ${BASE}\n`);

  const health = await api("/api/health");
  check("GET /api/health returns ok", health.status === 200 && health.body.status === "ok");

  const unauthCreate = await api("/api/studios", { method: "POST", body: { title: "nope" } });
  check("POST /api/studios without cookie is 401", unauthCreate.status === 401, unauthCreate.status);

  const weak = await api("/api/auth/register", {
    method: "POST",
    body: { name: "Weak Pass", email: `weak${Date.now()}@mail.com`, password: "abcdef" },
    withCookie: false,
  });
  check("register rejects password without uppercase", weak.status === 400, weak.status);

  const login = await api("/api/auth/login", {
    method: "POST",
    body: { email: EMAIL, password: PASSWORD },
    withCookie: false,
  });
  check("login sets HTTPOnly cookie", login.status === 200 && cookie.includes("studiospace_token="));

  const me = await api("/api/auth/me");
  check("GET /api/auth/me returns the user", me.status === 200 && me.body.data?.user?.email === EMAIL);

  const wrongLogin = await api("/api/auth/login", {
    method: "POST",
    body: { email: EMAIL, password: "WrongPass1" },
    withCookie: false,
  });
  check("login rejects wrong password", wrongLogin.status === 401, wrongLogin.status);

  const studios = await api("/api/studios?limit=3");
  check("GET /api/studios returns a grid page", studios.status === 200 && studios.body.data.length > 0);
  check("pagination metadata present", typeof studios.body.pagination?.total === "number");

  const sample = studios.body.data.find((studio) => studio.ownerEmail !== EMAIL) || studios.body.data[0];

  const detail = await api(`/api/studios/${sample._id}`);
  check("GET /api/studios/:id returns a studio", detail.status === 200 && detail.body.data?._id === sample._id);

  const availability = await api(`/api/studios/${sample._id}/availability?date=${tomorrow()}`);
  check("availability endpoint responds", availability.status === 200 && Array.isArray(availability.body.data?.bookedSlots));

  const create = await api("/api/studios", {
    method: "POST",
    body: {
      title: "Smoke Test Daylight Bay",
      category: "Photo Studio",
      hourlyRate: 44,
      securityDeposit: 80,
      capacity: 6,
      location: "Test Street, Dhaka",
      image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=1200",
      amenities: ["Backdrop", "Strobes", "Wi-Fi"],
      overview:
        "A short-lived listing created by the automated smoke test to verify the protected create flow.",
    },
  });
  check("POST /api/studios with cookie is 201", create.status === 201, JSON.stringify(create.body));
  created.studioId = create.body.data?._id;

  const listings = await api("/api/studios/my-listings");
  check(
    "GET /api/studios/my-listings only returns own studios",
    listings.status === 200 &&
      listings.body.data.every((studio) => studio.ownerEmail === EMAIL) &&
      listings.body.data.some((studio) => studio._id === created.studioId)
  );

  if (created.studioId) {
    const update = await api(`/api/studios/${created.studioId}`, {
      method: "PUT",
      body: { title: "Smoke Test Daylight Bay (Updated)", hourlyRate: 50 },
    });
    check("PUT /api/studios/:id updates the listing", update.status === 200 && update.body.data?.hourlyRate === 50);

    const otherUpdate = await api(`/api/studios/${sample._id}`, {
      method: "PUT",
      body: { title: "Hijacked listing" },
    });
    check(
      "PUT on someone else's studio is blocked",
      otherUpdate.status === 403 || otherUpdate.status === 401,
      otherUpdate.status
    );
  }

  const wish = await api(`/api/wishlist/${sample._id}`, { method: "POST" });
  check("POST /api/wishlist/:studioId saves the studio", wish.status === 201, wish.status);
  const wishIds = await api("/api/wishlist/ids");
  check("GET /api/wishlist/ids contains the studio", wishIds.body.data?.includes(sample._id));
  const unwish = await api(`/api/wishlist/${sample._id}`, { method: "DELETE" });
  check("DELETE /api/wishlist/:studioId removes it", unwish.status === 200);

  const booking = await api("/api/bookings", {
    method: "POST",
    body: {
      studioId: sample._id,
      date: tomorrow(),
      startTime: "10:00",
      endTime: "13:00",
      guests: 2,
      note: "Smoke test booking",
    },
  });
  check(
    "POST /api/bookings creates a Pending booking",
    booking.status === 201 && booking.body.data?.status === "Pending",
    JSON.stringify(booking.body)
  );
  if (booking.body.data?._id) {
    created.bookingIds = [new ObjectId(booking.body.data._id)];
  }

  const overlap = await api("/api/bookings", {
    method: "POST",
    body: { studioId: sample._id, date: tomorrow(), startTime: "12:00", endTime: "15:00" },
  });
  check("overlapping booking is rejected with 409", overlap.status === 409, overlap.status);

  const backToBack = await api("/api/bookings", {
    method: "POST",
    body: { studioId: sample._id, date: tomorrow(), startTime: "13:00", endTime: "15:00" },
  });
  check("back-to-back booking is allowed", backToBack.status === 201, backToBack.status);
  if (backToBack.body.data?._id) {
    const { ObjectId } = await import("mongodb");
    created.bookingIds.push(new ObjectId(backToBack.body.data._id));
  }

  const mine = await api("/api/bookings/my-bookings");
  check("GET /api/bookings/my-bookings lists reservations", mine.status === 200 && mine.body.data.length > 0);

  if (created.bookingIds[0]) {
    const cancel = await api(`/api/bookings/${created.bookingIds[0]}`, { method: "PATCH" });
    check("PATCH cancel endpoint requires /cancel sub-route", cancel.status === 404, cancel.status);

    const cancelReal = await api(`/api/bookings/${created.bookingIds[0]}/cancel`, { method: "PATCH" });
    check("PATCH /api/bookings/:id/cancel cancels a pending booking", cancelReal.status === 200);
  }

  const review = await api(`/api/studios/${sample._id}/reviews`, {
    method: "POST",
    body: { rating: 5, comment: "Automated smoke test review for the StudioSpace API." },
  });
  check("POST review is accepted once", review.status === 201 || review.status === 409, review.status);
  if (review.body.data?._id) {
    const { ObjectId } = await import("mongodb");
    created.reviewId = new ObjectId(review.body.data._id);
  }

  if (created.studioId) {
    const remove = await api(`/api/studios/${created.studioId}`, { method: "DELETE" });
    check("DELETE /api/studios/:id removes the listing", remove.status === 200);
    created.studioId = null;
  }

  await cleanup(created.studioId);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main().catch(async (error) => {
  console.error("Smoke test crashed:", error);
  await cleanup(created.studioId).catch(() => {});
  process.exit(1);
});
