const express = require("express");
const supabase = require("../supabase");
const { requireAuth, allowRoles } = require("../middleware/auth");
const router = express.Router();
const categories = ["Prepared meals", "Bakery", "Fruits & vegetables", "Dairy", "Packaged food", "Other"];

router.get("/", async (req, res, next) => {
  try {
    if (!supabase) return res.status(503).json({ error: "Database is not configured. Follow README setup first." });
    const now = new Date().toISOString();
    const { data, error } = await supabase.from("donations")
      .select("id,donor_id,title,category,quantity,location,pickup_deadline,prepared_at,allergen_info,storage_notes,description,status,created_at,profiles:donor_id(name,organization)")
      .eq("status", "available").gt("pickup_deadline", now).order("pickup_deadline", { ascending: true }).limit(100);
    if (error) throw error;
    const donations = (data || []).map(d => ({ ...d, donor_name: d.profiles?.organization || d.profiles?.name || "Community donor", profiles: undefined }));
    res.json({ donations });
  } catch (error) { next(error); }
});

router.post("/", requireAuth, allowRoles("donor", "admin"), async (req, res, next) => {
  try {
    const b = req.body || {};
    const title = text(b.title, 100), quantity = text(b.quantity, 80), location = text(b.location, 180);
    const category = text(b.category, 50), description = text(b.description, 1500), allergen_info = text(b.allergen_info, 1000), storage_notes = text(b.storage_notes, 1000);
    const deadline = new Date(b.pickup_deadline);
    const preparedAt = b.prepared_at ? new Date(b.prepared_at) : null;
    if (!title || !quantity || !location || !categories.includes(category)) return res.status(400).json({ error: "Complete the food name, category, quantity and pickup location." });
    if (!b.pickup_deadline || Number.isNaN(deadline.getTime()) || deadline <= new Date() || deadline > new Date(Date.now() + 14*24*60*60*1000)) return res.status(400).json({ error: "Pickup deadline must be in the future and within the next 14 days." });
    if (preparedAt && (Number.isNaN(preparedAt.getTime()) || preparedAt > new Date())) return res.status(400).json({ error: "Preparation/packing time must be a valid past or present date." });
    if (b.safety_confirmed !== true) return res.status(400).json({ error: "Please confirm that the food is suitable for donation." });
    const { data, error } = await supabase.from("donations").insert({
      donor_id: req.user.id, title, category, quantity, location,
      pickup_deadline: deadline.toISOString(), prepared_at: preparedAt ? preparedAt.toISOString() : null,
      allergen_info: allergen_info || "Not provided", storage_notes: storage_notes || null,
      description: description || null, safety_confirmed: true, status: "available"
    }).select("*").single();
    if (error) throw error;
    res.status(201).json({ donation: data });
  } catch (error) { next(error); }
});

router.get("/:id/claims", requireAuth, async (req, res, next) => {
  try {
    const { data: donation, error: dError } = await supabase.from("donations").select("id,donor_id").eq("id", req.params.id).maybeSingle();
    if (dError) throw dError;
    if (!donation) return res.status(404).json({ error: "Donation not found." });
    if (donation.donor_id !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "Only the donor or an administrator can view these requests." });
    const { data, error } = await supabase.from("claims").select("id,donation_id,recipient_id,status,message,created_at,profiles:recipient_id(name,organization)").eq("donation_id", req.params.id).order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ claims: (data || []).map(c => ({ ...c, recipient_name: c.profiles?.organization || c.profiles?.name || "Recipient", profiles: undefined })) });
  } catch (error) { next(error); }
});

function text(value, max) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
module.exports = router;
