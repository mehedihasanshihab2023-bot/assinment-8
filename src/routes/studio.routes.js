import { Router } from "express";
import { getCollections } from "../db.js";
import { optionalAuth, requireAuth } from "../lib/auth.js";
import { STUDIO_CATEGORIES } from "../lib/constants.js";
import { asyncHandler, httpError } from "../lib/http.js";
import {
  escapeRegex,
  optionalString,
  requireNumber,
  requireObjectId,
  requireString,
  requireUrl,
  toUrlList,
  toStringList,
  trimString,
} from "../lib/validate.js";

const router = Router();

const SORT_OPTIONS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  "price-asc": { hourlyRate: 1 },
  "price-desc": { hourlyRate: -1 },
  rating: { rating: -1, reviewCount: -1 },
  popular: { totalBookings: -1, rating: -1 },
};

function buildStudioPayload(body) {
  const title = requireString(body.title, "Studio title", { min: 4, max: 140 });
  const category = requireString(body.category, "Category", { min: 3, max: 60 });
  if (!STUDIO_CATEGORIES.includes(category)) {
    throw httpError(
      400,
      `Category must be one of: ${STUDIO_CATEGORIES.join(", ")}.`
    );
  }

  const hourlyRate = requireNumber(body.hourlyRate, "Hourly rate", {
    min: 1,
    max: 100000,
  });
  const securityDeposit = requireNumber(body.securityDeposit ?? 0, "Security deposit", {
    min: 0,
    max: 100000,
  });
  const capacity = requireNumber(body.capacity, "Max capacity", {
    min: 1,
    max: 2000,
    integer: true,
  });
  const location = requireString(body.location, "Location", { min: 4, max: 160 });
  const image = requireUrl(body.image, "Cover image URL");
  const overview = requireString(body.overview, "Detailed overview", {
    min: 20,
    max: 4000,
  });

  const gallery = toUrlList(body.gallery, "Gallery", { max: 8 });
  const amenities = toStringList(body.amenities, "Amenities", { max: 30, maxLength: 60 });
  const rules = optionalString(body.rules, "House rules", { max: 1500 });

  return {
    title,
    category,
    hourlyRate: Math.round(hourlyRate * 100) / 100,
    securityDeposit: Math.round(securityDeposit * 100) / 100,
    capacity,
    location,
    image,
    gallery: gallery.length ? gallery : [image],
    amenities,
    overview,
    rules,
  };
}

/** GET /api/studios – public, filterable, paginated grid data. */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { studios } = await getCollections();
    const {
      search = "",
      category = "",
      location = "",
      minPrice,
      maxPrice,
      minCapacity,
      ownerEmail = "",
      sort = "newest",
      page = 1,
      limit = 12,
    } = req.query;

    const filter = {};
    const searchText = trimString(search);
    if (searchText) {
      const rx = new RegExp(escapeRegex(searchText), "i");
      filter.$or = [{ title: rx }, { location: rx }, { overview: rx }, { category: rx }];
    }
    if (trimString(category)) {
      const requested = trimString(category);
      const matched = STUDIO_CATEGORIES.find(
        (item) => item.toLowerCase() === requested.toLowerCase()
      );
      filter.category = matched || requested;
    }
    if (trimString(location)) {
      filter.location = new RegExp(escapeRegex(trimString(location)), "i");
    }
    if (trimString(ownerEmail)) {
      filter.ownerEmail = trimString(ownerEmail).toLowerCase();
    }
    if (minPrice !== undefined && minPrice !== "") {
      filter.hourlyRate = { ...(filter.hourlyRate || {}), $gte: requireNumber(minPrice, "Minimum price", { min: 0 }) };
    }
    if (maxPrice !== undefined && maxPrice !== "") {
      filter.hourlyRate = { ...(filter.hourlyRate || {}), $lte: requireNumber(maxPrice, "Maximum price", { min: 0 }) };
    }
    if (minCapacity !== undefined && minCapacity !== "") {
      filter.capacity = { $gte: requireNumber(minCapacity, "Minimum capacity", { min: 1 }) };
    }

    const pageNumber = Math.max(1, requireNumber(page, "Page", { min: 1, integer: true }));
    const pageSize = Math.min(48, Math.max(1, requireNumber(limit, "Limit", { min: 1, integer: true })));
    const sortSpec = SORT_OPTIONS[trimString(sort)] || SORT_OPTIONS.newest;

    const [data, total] = await Promise.all([
      studios
        .find(filter)
        .sort(sortSpec)
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize)
        .toArray(),
      studios.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data,
      pagination: {
        total,
        page: pageNumber,
        limit: pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  })
);

/** GET /api/studios/featured – 6 top-rated / newest studios for the home page. */
router.get(
  "/featured",
  asyncHandler(async (req, res) => {
    const { studios } = await getCollections();
    const limit = Math.min(12, Math.max(1, Number(req.query.limit) || 6));
    const data = await studios
      .find({})
      .sort({ rating: -1, reviewCount: -1, createdAt: -1 })
      .limit(limit)
      .toArray();
    res.json({ success: true, data });
  })
);

/** GET /api/studios/my-listings – private, ownerEmail comes from the JWT. */
router.get(
  "/my-listings",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { studios } = await getCollections();
    const data = await studios
      .find({ ownerEmail: req.user.email })
      .sort({ createdAt: -1 })
      .toArray();
    res.json({ success: true, data });
  })
);

/** GET /api/studios/:id – full details + latest reviews + wishlist flag. */
router.get(
  "/:id",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const _id = requireObjectId(req.params.id, "studio id");
    const { studios, reviews, wishlists } = await getCollections();

    const studio = await studios.findOne({ _id });
    if (!studio) throw httpError(404, "This studio listing could not be found.");

    const [studioReviews, wishlisted] = await Promise.all([
      reviews.find({ studioId: _id }).sort({ createdAt: -1 }).limit(12).toArray(),
      req.user
        ? wishlists.findOne({ userEmail: req.user.email, studioId: _id })
        : Promise.resolve(null),
    ]);

    res.json({
      success: true,
      data: studio,
      reviews: studioReviews,
      isWishlisted: Boolean(wishlisted),
    });
  })
);

/** GET /api/studios/:id/availability?date=YYYY-MM-DD – booked slots for a day. */
router.get(
  "/:id/availability",
  asyncHandler(async (req, res) => {
    const studioId = requireObjectId(req.params.id, "studio id");
    const date = trimString(req.query.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw httpError(400, "A valid date query (?date=YYYY-MM-DD) is required.");
    }
    const { bookings } = await getCollections();
    const slots = await bookings
      .find(
        { studioId, date, status: { $in: ["Pending", "Confirmed"] } },
        { projection: { startTime: 1, endTime: 1, status: 1 } }
      )
      .sort({ startTime: 1 })
      .toArray();

    res.json({ success: true, data: { date, bookedSlots: slots } });
  })
);

/** POST /api/studios – protected mutation (Challenge 1). */
router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = buildStudioPayload(req.body || {});
    const { studios } = await getCollections();
    const now = new Date();

    const document = {
      ...payload,
      ownerEmail: req.user.email,
      ownerName: req.user.name,
      ownerPhoto: req.user.photo,
      rating: 0,
      reviewCount: 0,
      totalBookings: 0,
      createdAt: now,
      updatedAt: now,
    };

    const result = await studios.insertOne(document);
    res.status(201).json({
      success: true,
      message: "Studio published successfully.",
      data: { ...document, _id: result.insertedId },
    });
  })
);

/** PUT/PATCH /api/studios/:id – owner-only update. */
const updateStudio = asyncHandler(async (req, res) => {
  const _id = requireObjectId(req.params.id, "studio id");
  const { studios } = await getCollections();

  const existing = await studios.findOne({ _id });
  if (!existing) throw httpError(404, "This studio listing could not be found.");
  if (existing.ownerEmail !== req.user.email) {
    throw httpError(403, "Only the owner of this studio can edit the listing.");
  }

  const payload = buildStudioPayload({ ...existing, ...req.body });
  const { matchedCount } = await studios.updateOne(
    { _id, ownerEmail: req.user.email },
    { $set: { ...payload, updatedAt: new Date() } }
  );
  if (!matchedCount) throw httpError(404, "This studio listing could not be found.");

  const updated = await studios.findOne({ _id });
  res.json({
    success: true,
    message: "Studio listing updated successfully.",
    data: updated,
  });
});

router.put("/:id", requireAuth, updateStudio);
router.patch("/:id", requireAuth, updateStudio);

/** DELETE /api/studios/:id – owner-only, cleans related wishlists/reviews. */
router.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const _id = requireObjectId(req.params.id, "studio id");
    const { studios, wishlists, reviews } = await getCollections();

    const studio = await studios.findOne({ _id });
    if (!studio) throw httpError(404, "This studio listing could not be found.");
    if (studio.ownerEmail !== req.user.email) {
      throw httpError(403, "Only the owner of this studio can delete the listing.");
    }

    await Promise.all([
      studios.deleteOne({ _id, ownerEmail: req.user.email }),
      wishlists.deleteMany({ studioId: _id }),
      reviews.deleteMany({ studioId: _id }),
    ]);

    res.json({
      success: true,
      message: `"${studio.title}" was deleted successfully.`,
      data: { id: String(_id) },
    });
  })
);

export default router;
