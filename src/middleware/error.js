import { HttpError } from "../lib/http.js";

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} does not exist on the StudioSpace API.`,
  });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, next) {
  let status = error instanceof HttpError ? error.status : error.status || 500;
  let message = error.message || "Something went wrong on the server.";

  if (error.code === 11000) {
    status = 409;
    const field = Object.keys(error.keyPattern || error.keyValue || {})[0] || "value";
    message =
      field === "email"
        ? "An account with this email already exists."
        : "This record already exists.";
  }

  if (error.name === "BSONError" || error.name === "BSONTypeError") {
    status = 400;
    message = "Invalid identifier supplied.";
  }

  if (status >= 500) {
    console.error("[StudioSpace API]", error);
    if (!isMongoConfigError(error)) {
      message = "Something went wrong on the server. Please try again.";
    }
  }

  res.status(status).json({
    success: false,
    message,
    ...(error.details ? { details: error.details } : {}),
  });
}

function isMongoConfigError(error) {
  return /MONGODB_URI|JWT_SECRET/.test(String(error.message || ""));
}
