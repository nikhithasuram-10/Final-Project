const jwt = require("jsonwebtoken");
const supabase = require("../supabase");

function signToken(user) {
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: "8h", issuer: "sharebite-api", audience: "sharebite-web" });
}

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Please sign in to continue." });
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { issuer: "sharebite-api", audience: "sharebite-web" });
    if (!supabase) return res.status(503).json({ error: "Database is not configured." });
    const { data: user, error } = await supabase.from("profiles").select("id,name,email,organization,role,is_active").eq("id", decoded.sub).maybeSingle();
    if (error || !user || !user.is_active) return res.status(401).json({ error: "Your session is invalid or the account is inactive." });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Your session is invalid or expired. Please sign in again." });
  }
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: "Your account does not have permission to perform this action." });
    next();
  };
}

module.exports = { signToken, requireAuth, allowRoles };
