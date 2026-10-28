const express = require("express");
const bcrypt = require("bcryptjs");
const supabase = require("../supabase");
const { signToken, requireAuth } = require("../middleware/auth");

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/register", async (req, res, next) => {
  try {
    if (!supabase) return res.status(503).json({ error: "Database is not configured. Follow README setup first." });
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const organization = typeof req.body.organization === "string" ? req.body.organization.trim() : "";
    const role = req.body.role;
    if (name.length < 2 || name.length > 100) return res.status(400).json({ error: "Enter a name between 2 and 100 characters." });
    if (!emailPattern.test(email) || email.length > 254) return res.status(400).json({ error: "Enter a valid email address." });
    if (password.length < 8 || password.length > 128) return res.status(400).json({ error: "Password must be 8–128 characters long." });
    if (!["donor", "recipient"].includes(role)) return res.status(400).json({ error: "Choose donor or recipient account type." });
    const { data: existing, error: lookupError } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) return res.status(409).json({ error: "An account with this email already exists." });
    const password_hash = await bcrypt.hash(password, 12);
    const { data: user, error } = await supabase.from("profiles").insert({
      name, email, organization: organization || null, role, password_hash, is_active: true
    }).select("id,name,email,organization,role,is_active").single();
    if (error) throw error;
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (error) { next(error); }
});

router.post("/login", async (req, res, next) => {
  try {
    if (!supabase) return res.status(503).json({ error: "Database is not configured. Follow README setup first." });
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    if (!emailPattern.test(email) || !password) return res.status(400).json({ error: "Enter your email and password." });
    const { data: user, error } = await supabase.from("profiles").select("*").eq("email", email).maybeSingle();
    if (error) throw error;
    if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Email or password is incorrect." });
    }
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (error) { next(error); }
});

router.get("/me", requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, organization: user.organization, role: user.role };
}
module.exports = router;
