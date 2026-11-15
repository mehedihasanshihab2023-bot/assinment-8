import { Router } from "express";
import { getCollections } from "../db.js";
import { requireAuth } from "../lib/auth.js";
import { asyncHandler, httpError } from "../lib/http.js";
import { requireNumber, requireObjectId, requireString } from "../lib/validate.js";

const router = Router({ mergeParams: true });

async function refreshStudioRating(studios, reviews, studioId) {
  const [summary] = await reviews
    .aggregate([
      { $match: { studioId } },
      { $group: { _id: "$studioId", average: { $avg: "$rating" }, count: { $sum: 1 } } },
    ])
    .toArray();

  const rating = summary ? Math.round(summary.average * 10) / 10 : 0;
  const reviewCount = summary ? summary.count : 0;
  await studios.updateOne({ _id: studioId }, { $set: { rating, reviewCount } });
  return { rating, reviewCount };
}

/** GET /api/studios/:studioId/reviews */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const studioId = requireObjectId(req.params.studioId, "studio id");
    const { reviews } = await getCollections();
    const data = await reviews
      .find({ studioId })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    res.json({ success: true, data });
  })
);

/** POST /api/studios/:studioId/reviews – one review per creator per studio. */
router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const studioId = requireObjectId(req.params.studioId, "studio id");
    const rating = requireNumber(req.body?.rating, "Rating", { min: 1, max: 5, integer: true });
    const comment = requireString(req.body?.comment, "Review", { min: 5, max: 800 });

    const { studios, reviews } = await getCollections();
    const studio = await studios.findOne({ _id: studioId }, { projection: { ownerEmail: 1 } });
    if (!studio) throw httpError(404, "This studio listing could not be found.");
    if (studio.ownerEmail === req.user.email) {
      throw httpError(403, "Hosts cannot review their own studio.");
    }

    const existing = await reviews.findOne({ studioId, userEmail: req.user.email });
    if (existing) {
      throw httpError(409, "You have already reviewed this studio.");
    }

    const document = {
      studioId,
      userEmail: req.user.email,
      userName: req.user.name,
      userPhoto: req.user.photo,
      rating,
      comment,
      createdAt: new Date(),
    };
    const result = await reviews.insertOne(document);
    const aggregate = await refreshStudioRating(studios, reviews, studioId);

    res.status(201).json({
      success: true,
      message: "Thanks for sharing your review.",
      data: { ...document, _id: result.insertedId },
      studioRating: aggregate,
    });
  })
);

/** DELETE /api/studios/:studioId/reviews/:reviewId – author only. */
router.delete(
  "/:reviewId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const studioId = requireObjectId(req.params.studioId, "studio id");
    const reviewId = requireObjectId(req.params.reviewId, "review id");
    const { studios, reviews } = await getCollections();

    const review = await reviews.findOne({ _id: reviewId, studioId });
    if (!review) throw httpError(404, "This review could not be found.");
    if (review.userEmail !== req.user.email) {
      throw httpError(403, "You can only delete your own review.");
    }

    await reviews.deleteOne({ _id: reviewId });
    await refreshStudioRating(studios, reviews, studioId);

    res.json({ success: true, message: "Review deleted.", data: { id: String(reviewId) } });
  })
);

export default router;
