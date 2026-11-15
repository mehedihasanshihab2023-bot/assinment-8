import { ObjectId } from "mongodb";
import { httpError } from "./http.js";

export const trimString = (value) => (typeof value === "string" ? value.trim() : "");

export const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function requireString(value, field, { min = 1, max = 4000 } = {}) {
  const text = trimString(value);
  if (!text) throw httpError(400, `${field} is required.`);
  if (text.length < min) {
    throw httpError(400, `${field} must be at least ${min} characters long.`);
  }
  if (text.length > max) {
    throw httpError(400, `${field} must be at most ${max} characters long.`);
  }
  return text;
}

export function optionalString(value, field, { max = 4000 } = {}) {
  if (value === undefined || value === null) return "";
  const text = trimString(value);
  if (text.length > max) {
    throw httpError(400, `${field} must be at most ${max} characters long.`);
  }
  return text;
}

export function requireNumber(
  value,
  field,
  { min = 0, max = 1_000_000, integer = false, allowZero = true } = {}
) {
  const number = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isFinite(number)) {
    throw httpError(400, `${field} must be a valid number.`);
  }
  if (!allowZero && number === 0) {
    throw httpError(400, `${field} must be greater than 0.`);
  }
  if (number < min) throw httpError(400, `${field} must be ${min} or greater.`);
  if (number > max) throw httpError(400, `${field} must be ${max} or less.`);
  if (integer && !Number.isInteger(number)) {
    throw httpError(400, `${field} must be a whole number.`);
  }
  return number;
}

export function requireEmail(value, field = "Email") {
  const email = trimString(value).toLowerCase();
  const pattern = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
  if (!email) throw httpError(400, `${field} is required.`);
  if (!pattern.test(email)) throw httpError(400, "Please provide a valid email address.");
  if (email.length > 160) throw httpError(400, `${field} is too long.`);
  return email;
}

/** Enforces the assignment password rules: 6+ chars, one upper, one lower. */
export function validatePassword(value, field = "Password") {
  const password = typeof value === "string" ? value : "";
  if (!password) throw httpError(400, `${field} is required.`);
  if (password.length < 6) {
    throw httpError(400, `${field} must be at least 6 characters long.`);
  }
  if (password.length > 72) {
    throw httpError(400, `${field} must be at most 72 characters long.`);
  }
  if (!/[A-Z]/.test(password)) {
    throw httpError(400, `${field} must contain at least one uppercase letter.`);
  }
  if (!/[a-z]/.test(password)) {
    throw httpError(400, `${field} must contain at least one lowercase letter.`);
  }
  return password;
}

export function requireUrl(value, field, { optional = false } = {}) {
  const url = trimString(value);
  if (!url) {
    if (optional) return "";
    throw httpError(400, `${field} is required.`);
  }
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("bad protocol");
    }
  } catch {
    throw httpError(400, `${field} must be a valid http(s) image URL.`);
  }
  return url;
}

/** Accepts an array or a comma separated string and returns a clean string array. */
export function toStringList(value, field, { max = 40, maxLength = 120 } = {}) {
  if (value === undefined || value === null || value === "") return [];
  const raw = Array.isArray(value) ? value : String(value).split(",");
  const list = raw
    .map((item) => trimString(item))
    .filter(Boolean)
    .filter((item, index, array) => array.indexOf(item) === index);
  if (list.length > max) throw httpError(400, `${field} cannot contain more than ${max} items.`);
  list.forEach((item) => {
    if (item.length > maxLength) {
      throw httpError(400, `Each item in ${field} must be at most ${maxLength} characters.`);
    }
  });
  return list;
}

export function toUrlList(value, field, { max = 8 } = {}) {
  if (value === undefined || value === null || value === "") return [];
  const raw = Array.isArray(value) ? value : String(value).split(",");
  const list = raw.map((item) => trimString(item)).filter(Boolean);
  if (list.length > max) throw httpError(400, `${field} cannot contain more than ${max} links.`);
  return list.map((url) => requireUrl(url, field));
}

export function requireObjectId(value, field = "id") {
  const id = trimString(value);
  if (!ObjectId.isValid(id)) throw httpError(400, `Invalid ${field}.`);
  return new ObjectId(id);
}

export function optionalDate(value, field) {
  const text = trimString(value);
  if (!text) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) throw httpError(400, `${field} must use the YYYY-MM-DD format.`);
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw httpError(400, `${field} is not a valid date.`);
  if (date.toISOString().slice(0, 10) !== text) {
    throw httpError(400, `${field} is not a valid calendar date.`);
  }
  return text;
}

/** Normalises "9:30" to "09:30" and rejects anything that is not a real 24h time. */
export function requireTime(value, field) {
  const text = trimString(value);
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(text);
  if (!match) throw httpError(400, `${field} must use the HH:mm 24-hour format.`);
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

export const timeToMinutes = (time) => {
  const [hours, minutes] = String(time).split(":").map(Number);
  return hours * 60 + minutes;
};

export const minutesToTime = (minutes) => {
  const safe = Math.max(0, Math.min(24 * 60, Math.round(minutes)));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};
