import "dotenv/config";
import app from "./src/app.js";
import { ensureIndexes } from "./src/db.js";

const port = process.env.PORT || 8000;

async function start() {
  try {
    await ensureIndexes();
    console.log("Connected to MongoDB and verified indexes.");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
  }

  app.listen(port, () => {
    console.log(`StudioSpace API listening on http://localhost:${port}`);
  });
}

start();
