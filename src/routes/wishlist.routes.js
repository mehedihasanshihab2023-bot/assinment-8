import { Router } from "express";
import { getCollections } from "../db.js";
import { requireAuth } from "../lib/auth.js";
import { asyncHandler, httpError } from "../lib/http.js";
import { requireObjectId } from "../lib/validate.js";

const router = Router();

router.use(requireAuth);

/** GET /api/wishlist – saved studios with full studio documents. */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { wishlists, studios } = await getCollections();
    const saved = await wishlists.find({ userEmail: req.user.email }).sort({ createdAt: -1 }).toArray();
    const ids = saved.map((item) => item.studioId);
    const documents = ids.length ? await studios.find({ _id: { $in: ids } }).toArray() : [];
    const byId = new Map(documents.map((studio) => [String(studio._id), studio]));

    const data = saved
      .map((item) => {
        const studio = byId.get(String(item.studioId));
        return studio ? { ...studio, savedAt: item.createdAt } : null;
      })
      .filter(Boolean);

    res.json({ success: true, data });
  })
);

/** GET /api/wishlist/ids – lightweight list so card hearts can render instantly. */
router.get(
  "/ids",
  asyncHandler(async (req, res) => {
    const { wishlists } = await getCollections();
    const saved = await wishlists
      .find({ userEmail: req.user.email }, { projection: { studioId: 1 } })
      .toArray();
    res.json({ success: true, data: saved.map((item) => String(item.studioId)) });
  })
);

/** POST /api/wishlist/:studioId */
router.post(
  "/:studioId",
  asyncHandler(async (req, res) => {
    const studioId = requireObjectId(req.params.studioId, "studio id");
    const { studios, wishlists } = await getCollections();

    const studio = await studios.findOne({ _id: studioId }, { projection: { title: 1 } });
    if (!studio) throw httpError(404, "This studio listing could not be found.");

    await wishlists.updateOne(
      { userEmail: req.user.email, studioId },
      { $setOnInsert: { userEmail: req.user.email, studioId, createdAt: new Date() } },
      { upsert: true }
    );

    res.status(201).json({
      success: true,
      message: `"${studio.title}" was added to your wishlist.`,
      data: { studioId: String(studioId), saved: true },
    });
  })
);

/** DELETE /api/wishlist/:studioId */
router.delete(
  "/:studioId",
  asyncHandler(async (req, res) => {
    const studioId = requireObjectId(req.params.studioId, "studio id");
    const { wishlists } = await getCollections();
    await wishlists.deleteOne({ userEmail: req.user.email, studioId });
    res.json({
      success: true,
      message: "Removed from your wishlist.",
      data: { studioId: String(studioId), saved: false },
    });
  })
);

export default router;
