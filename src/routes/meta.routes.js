import { Router } from "express";
import { getCollections } from "../db.js";
import { CATEGORY_PRESETS, STUDIO_CATEGORIES } from "../lib/constants.js";
import { asyncHandler, httpError } from "../lib/http.js";

const router = Router();

/** GET /api/meta/categories – category cards with live counts. */
router.get(
  "/categories",
  asyncHandler(async (req, res) => {
    const { studios } = await getCollections();
    const counts = await studios
      .aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }])
      .toArray();
    const countMap = new Map(counts.map((item) => [item._id, item.count]));

    const data = CATEGORY_PRESETS.map((preset) => ({
      ...preset,
      count: countMap.get(preset.name) || 0,
    }));

    res.json({ success: true, data, categories: STUDIO_CATEGORIES });
  })
);

/** GET /api/meta/stats – counters used by the home page trust strip. */
router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const { studios, bookings, users, reviews } = await getCollections();
    const [studioCount, bookingCount, hostEmails, locations, reviewSummary] = await Promise.all([
      studios.countDocuments({}),
      bookings.countDocuments({}),
      studios.distinct("ownerEmail"),
      studios.distinct("location"),
      reviews
        .aggregate([{ $group: { _id: null, average: { $avg: "$rating" } } }])
        .toArray(),
    ]);

    res.json({
      success: true,
      data: {
        studios: studioCount,
        bookings: bookingCount,
        hosts: hostEmails.length,
        locations: locations.length,
        creators: await users.countDocuments({}),
        averageRating: reviewSummary[0]?.average
          ? Math.round(reviewSummary[0].average * 10) / 10
          : 0,
      },
    });
  })
);

/** POST /api/meta/upload – optional imgbb proxy so the API key stays server-side. */
router.post(
  "/upload",
  asyncHandler(async (req, res) => {
    const key = process.env.IMGBB_API_KEY;
    if (!key) {
      throw httpError(
        501,
        "Image uploads are not configured. Add IMGBB_API_KEY or paste an image URL instead."
      );
    }
    const image = req.body?.image;
    if (!image || typeof image !== "string") {
      throw httpError(400, "Provide a base64 encoded image in the 'image' field.");
    }

    const payload = new URLSearchParams({
      key,
      image: image.replace(/^data:image\/[a-z0-9+.-]+;base64,/i, ""),
      name: String(req.body?.name || `studiospace-${Date.now()}`).slice(0, 60),
    });

    const response = await fetch("https://api.imgbb.com/1/upload", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload.toString(),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result?.success) {
      throw httpError(
        response.status === 400 ? 400 : 502,
        result?.error?.message || "Image upload failed. Please try again."
      );
    }

    res.status(201).json({
      success: true,
      message: "Image uploaded successfully.",
      data: {
        url: result.data.display_url,
        thumb: result.data.thumb?.url || result.data.display_url,
        deleteUrl: result.data.delete_url,
      },
    });
  })
);

export default router;
