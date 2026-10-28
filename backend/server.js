require("dotenv").config();
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const supabase = require("./supabase");
const authRoutes = require("./routes/auth");
const donationRoutes = require("./routes/donations");
const claimRoutes = require("./routes/claims");
const dashboardRoutes = require("./routes/dashboard");

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.includes("REPLACE_WITH")) {
  console.warn("WARNING: Set JWT_SECRET to a strong random value of at least 32 characters in backend/.env before using accounts.");
}

const app = express();
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: { directives: {
  defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"], imgSrc: ["'self'", "data:"],
  connectSrc: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'none'"], upgradeInsecureRequests: null
}}}));
app.use(express.json({ limit: "32kb" }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false }));
app.use("/api", (req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });

app.get("/api/health", (req, res) => res.json({
  status: "ok",
  databaseConfigured: Boolean(supabase),
  time: new Date().toISOString()
}));
app.use("/api/auth", authRoutes);
app.use("/api/donations", donationRoutes);
app.use("/api", claimRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use(express.static(path.join(__dirname, "..", "frontend"), { extensions: ["html"] }));
app.use("/api", (req, res) => res.status(404).json({ error: "API endpoint not found." }));
app.use((err, req, res, next) => {
  console.error("Request failed:", err?.message || "Unknown error");
  if (res.headersSent) return next(err);
  const status = Number.isInteger(err.status) ? err.status : 500;
  res.status(status).json({ error: status >= 500 ? "Something went wrong. Check server configuration and logs." : err.message });
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`ShareBite is running at http://localhost:${port}`));
