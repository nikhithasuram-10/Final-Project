const express = require("express");
const supabase = require("../supabase");
const { requireAuth } = require("../middleware/auth");
const router = express.Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    let donations = [], claims = [];
    if (["donor","admin"].includes(req.user.role)) {
      const query = supabase.from("donations").select("*").order("created_at", { ascending: false }).limit(100);
      const { data, error } = req.user.role === "admin" ? await query : await query.eq("donor_id", req.user.id);
      if (error) throw error;
      donations = data || [];
    }
    let claimQuery = supabase.from("claims").select("id,donation_id,recipient_id,status,message,created_at,donations:donation_id(id,title,quantity,donor_id,profiles:donor_id(name,organization)),profiles:recipient_id(name,organization)").order("created_at", { ascending: false }).limit(200);
    if (req.user.role === "recipient") claimQuery = claimQuery.eq("recipient_id", req.user.id);
    const { data: claimData, error: claimError } = await claimQuery;
    if (claimError) throw claimError;
    claims = (claimData || []).filter(c => req.user.role === "admin" || req.user.role === "recipient" || c.donations?.donor_id === req.user.id).map(c => ({
      id: c.id, donation_id: c.donation_id, status: c.status, message: c.message, created_at: c.created_at,
      donation_title: c.donations?.title || "Donation", donation_quantity: c.donations?.quantity || "—",
      donation_donor_id: c.donations?.donor_id,
      other_party_name: req.user.role === "donor" ? (c.profiles?.organization || c.profiles?.name) : (c.donations?.profiles?.organization || c.donations?.profiles?.name)
    }));
    const completed = claims.filter(c => c.status === "completed").length + donations.filter(d => d.status === "completed").length;
    res.json({ donations, claims, stats: { donations: donations.length, claims: claims.length, completed } });
  } catch (error) { next(error); }
});
module.exports = router;
