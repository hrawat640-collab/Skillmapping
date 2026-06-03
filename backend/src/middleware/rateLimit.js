/**
 * Fixed-window in-memory rate limiter (no extra dependencies).
 * Suitable for a single Node instance; for multi-instance use a shared store.
 */
const CLEANUP_EVERY = 2500;

export function createRateLimiter(options) {
  const windowMs = Number(options?.windowMs || 60_000);
  const max = Math.max(1, Number(options?.max || 60));
  const keyGenerator =
    options?.keyGenerator ||
    ((req) => `${req.ip || req.socket?.remoteAddress || "unknown"}:${req.path || ""}`);
  const store = new Map();
  let tick = 0;

  function prune(now) {
    for (const [k, v] of store) {
      if (now >= v.resetAt) store.delete(k);
    }
  }

  return function rateLimiter(req, res, next) {
    const now = Date.now();
    if (++tick > CLEANUP_EVERY) {
      tick = 0;
      prune(now);
    }
    const key = keyGenerator(req);
    let bucket = store.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      store.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      const retrySec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retrySec));
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "rate_limit_exceeded",
          request_id: req.requestId || null,
          path: req.originalUrl,
          key_hint: String(key).slice(0, 120)
        })
      );
      return res.status(429).json({
        error: "Too many requests. Please wait a moment and try again.",
        code: "RATE_LIMIT_EXCEEDED"
      });
    }
    next();
  };
}

const searchPerMin = Number(process.env.RATE_LIMIT_SEARCH_PER_MIN || 48);
const authRegisterPerMin = Number(process.env.RATE_LIMIT_AUTH_REGISTER_PER_MIN || 12);
const authLoginPerMin = Number(process.env.RATE_LIMIT_AUTH_LOGIN_PER_MIN || 30);

export const searchOrchestratedLimiter = createRateLimiter({
  windowMs: 60_000,
  max: searchPerMin,
  keyGenerator: (req) => `${req.ip || "unknown"}:search_orch`
});

export const searchLegacyLimiter = createRateLimiter({
  windowMs: 60_000,
  max: searchPerMin,
  keyGenerator: (req) => `${req.ip || "unknown"}:search_legacy`
});

export const authRegisterLimiter = createRateLimiter({
  windowMs: 60_000,
  max: authRegisterPerMin,
  keyGenerator: (req) => `${req.ip || "unknown"}:auth_register`
});

export const authLoginLimiter = createRateLimiter({
  windowMs: 60_000,
  max: authLoginPerMin,
  keyGenerator: (req) => `${req.ip || "unknown"}:auth_login`
});
