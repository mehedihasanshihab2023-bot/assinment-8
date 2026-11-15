/**
 * Small HTTP helpers shared by every route.
 */

export class HttpError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}

export const httpError = (status, message, details = null) =>
  new HttpError(status, message, details);

/** Wraps async route handlers so rejected promises reach the error middleware. */
export const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);
