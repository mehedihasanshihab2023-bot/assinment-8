import { Router } from "express";
import { getCollections } from "../db.js";
import { requireAuth } from "../lib/auth.js";
import { BOOKING_STATUS } from "../lib/constants.js";
import { asyncHandler, httpError } from "../lib/http.js";
import {
  optionalString,
  requireNumber,
  requireObjectId,
  requireTime,
  timeToMinutes,
  trimString,
  optionalDate,
} from "../lib/validate.js";

const router = Router();

const SERVICE_FEE_RATE = 0.05;
const ACTIVE_STATUSES = ["Pending", "Confirmed"];

const round2 = (value) => Math.round(value * 100) / 100;

function bookingCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `SS-${suffix}`;
}

/**
 * Challenge 2: reject any reservation whose [start, end) window overlaps an
 * existing Pending/Confirmed booking for the same studio on the same date.
 */
async function findConflict(bookings, { studioId, date, startTime, endTime, excludeId }) {
  const filter = {
    studioId,
    date,
    status: { $in: ACTIVE_STATUSES },
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  };
  if (excludeId) filter._id = { $ne: excludeId };
  return bookings.findOne(filter, { sort: { startTime: 1 } });
}

function conflictMessage(conflict) {
  return `That time overlaps an existing booking (${conflict.startTime} – ${conflict.endTime}, ${conflict.status}). Please choose another slot.`;
}

/** POST /api/bookings – protected mutation, status starts as "Pending". */
router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const studioId = requireObjectId(body.studioId, "studio id");
    const date = optionalDate(body.date, "Booking date");
    if (!date) throw httpError(400, "Booking date is required.");

    const startTime = requireTime(body.startTime, "Start time");
    const endTime = requireTime(body.endTime, "End time");
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);

    if (endMinutes <= startMinutes) {
      throw httpError(400, "End time must be later than the start time.");
    }
    const hours = round2((endMinutes - startMinutes) / 60);
    if (hours < 0.5) throw httpError(400, "Bookings must be at least 30 minutes long.");
    if (hours > 12) throw httpError(400, "A single booking cannot exceed 12 hours.");

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate()
    ).padStart(2, "0")}`;
    if (date < todayKey) {
      throw httpError(400, "You cannot book a date in the past.");
    }

    const { studios, bookings } = await getCollections();
    const studio = await studios.findOne({ _id: studioId });
    if (!studio) throw httpError(404, "This studio listing could not be found.");
    if (studio.ownerEmail === req.user.email) {
      throw httpError(400, "You cannot book your own studio.");
    }

    const guests = body.guests
      ? requireNumber(body.guests, "Guests", { min: 1, max: studio.capacity, integer: true })
      : 1;

    const conflict = await findConflict(bookings, { studioId, date, startTime, endTime });
    if (conflict) throw httpError(409, conflictMessage(conflict));

    const subtotal = round2(studio.hourlyRate * hours);
    const serviceFee = round2(subtotal * SERVICE_FEE_RATE);
    const total = round2(subtotal + serviceFee);
    const now = new Date();

    const document = {
      bookingCode: bookingCode(),
      studioId,
      studioTitle: studio.title,
      studioImage: studio.image,
      studioCategory: studio.category,
      studioLocation: studio.location,
      hourlyRate: studio.hourlyRate,
      securityDeposit: studio.securityDeposit,
      ownerEmail: studio.ownerEmail,
      ownerName: studio.ownerName,
      userEmail: req.user.email,
      userName: req.user.name,
      userPhoto: req.user.photo,
      date,
      startTime,
      endTime,
      hours,
      guests,
      subtotal,
      serviceFee,
      total,
      note: optionalString(body.note, "Note", { max: 500 }),
      status: "Pending",
      createdAt: now,
      updatedAt: now,
    };

    const result = await bookings.insertOne(document);
    await studios.updateOne({ _id: studioId }, { $inc: { totalBookings: 1 } });

    res.status(201).json({
      success: true,
      message: `Booking request sent to ${studio.ownerName}. It is pending host confirmation.`,
      data: { ...document, _id: result.insertedId },
    });
  })
);

/** GET /api/bookings/my-bookings – reservations made by the signed-in creator. */
router.get(
  "/my-bookings",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { bookings } = await getCollections();
    const filter = { userEmail: req.user.email };
    const status = trimString(req.query.status);
    if (status && BOOKING_STATUS.includes(status)) filter.status = status;

    const data = await bookings.find(filter).sort({ createdAt: -1 }).toArray();
    res.json({ success: true, data });
  })
);

/** GET /api/bookings/received – reservations on studios owned by the user. */
router.get(
  "/received",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { bookings } = await getCollections();
    const filter = { ownerEmail: req.user.email };
    const status = trimString(req.query.status);
    if (status && BOOKING_STATUS.includes(status)) filter.status = status;

    const data = await bookings.find(filter).sort({ createdAt: -1 }).toArray();
    res.json({ success: true, data });
  })
);

/** PATCH /api/bookings/:id/cancel – guests cancel Pending, hosts can also cancel Confirmed. */
router.patch(
  "/:id/cancel",
  requireAuth,
  asyncHandler(async (req, res) => {
    const _id = requireObjectId(req.params.id, "booking id");
    const { bookings } = await getCollections();

    const booking = await bookings.findOne({ _id });
    if (!booking) throw httpError(404, "This booking could not be found.");

    const isGuest = booking.userEmail === req.user.email;
    const isHost = booking.ownerEmail === req.user.email;
    if (!isGuest && !isHost) {
      throw httpError(403, "You are not allowed to modify this booking.");
    }
    if (booking.status === "Cancelled") throw httpError(400, "This booking is already cancelled.");
    if (booking.status === "Completed") throw httpError(400, "Completed bookings cannot be cancelled.");
    if (booking.status === "Confirmed" && !isHost) {
      throw httpError(400, "This slot is already confirmed. Contact the host to cancel it.");
    }

    await bookings.updateOne(
      { _id },
      { $set: { status: "Cancelled", cancelledBy: isHost ? "host" : "guest", updatedAt: new Date() } }
    );

    res.json({
      success: true,
      message: "Booking cancelled. The slot is available again.",
      data: { ...booking, status: "Cancelled" },
    });
  })
);

/** PATCH /api/bookings/:id/status – host confirms, completes or cancels. */
router.patch(
  "/:id/status",
  requireAuth,
  asyncHandler(async (req, res) => {
    const _id = requireObjectId(req.params.id, "booking id");
    const status = trimString(req.body?.status);
    if (!["Confirmed", "Completed", "Cancelled"].includes(status)) {
      throw httpError(400, "Status must be Confirmed, Completed or Cancelled.");
    }

    const { bookings } = await getCollections();
    const booking = await bookings.findOne({ _id });
    if (!booking) throw httpError(404, "This booking could not be found.");
    if (booking.ownerEmail !== req.user.email) {
      throw httpError(403, "Only the studio host can update the booking status.");
    }
    if (booking.status === status) {
      throw httpError(400, `This booking is already ${status.toLowerCase()}.`);
    }
    if (booking.status === "Cancelled") {
      throw httpError(400, "Cancelled bookings cannot be changed.");
    }
    if (booking.status === "Completed") {
      throw httpError(400, "Completed bookings cannot be changed.");
    }

    if (status === "Confirmed") {
      const conflict = await findConflict(bookings, {
        studioId: booking.studioId,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        excludeId: booking._id,
      });
      if (conflict && conflict.status === "Confirmed") {
        throw httpError(409, conflictMessage(conflict));
      }
    }

    await bookings.updateOne({ _id }, { $set: { status, updatedAt: new Date() } });
    res.json({
      success: true,
      message: `Booking ${status.toLowerCase()} successfully.`,
      data: { ...booking, status },
    });
  })
);

export default router;
