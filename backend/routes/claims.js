const express = require("express");
const supabase = require("../supabase");
const { requireAuth, allowRoles } = require("../middleware/auth");
const router = express.Router();

router.post("/donations/:id/claims", requireAuth, allowRoles("recipient", "admin"), async (req, res, next) => {
  try {
    const { data: donation, error: dError } = await supabase.from("donations").select("id,donor_id,title,status,pickup_deadline").eq("id", req.params.id).maybeSingle();
    if (dError) throw dError;
    if (!donation) return res.status(404).json({ error: "Donation not found." });
    if (donation.donor_id === req.user.id) return res.status(400).json({ error: "You cannot request your own donation." });
    if (donation.status !== "available" || new Date(donation.pickup_deadline) <= new Date()) return res.status(409).json({ error: "This donation is no longer available." });
    const { data: existing, error: eError } = await supabase.from("claims").select("id,status").eq("donation_id", donation.id).eq("recipient_id", req.user.id).in("status", ["pending","approved"]).maybeSingle();
    if (eError) throw eError;
    if (existing) return res.status(409).json({ error: "You already have an active request for this donation." });
    const message = typeof req.body.message === "string" ? req.body.message.trim().slice(0, 500) : "";
    const { data, error } = await supabase.from("claims").insert({ donation_id: donation.id, recipient_id: req.user.id, status: "pending", message: message || null }).select("*").single();
    if (error) {
      if (error.code === "23505") return res.status(409).json({ error: "You already have a request for this donation." });
      throw error;
    }
    res.status(201).json({ claim: data });
  } catch (error) { next(error); }
});

router.patch("/claims/:id", requireAuth, allowRoles("donor", "admin"), async (req, res, next) => {
  try {
    const status = req.body?.status;
    if (!["approved","rejected","completed"].includes(status)) return res.status(400).json({ error: "Status must be approved, rejected or completed." });
    const { data: claim, error: cError } = await supabase.from("claims").select("id,donation_id,recipient_id,status,donations:donation_id(id,donor_id,status,pickup_deadline)").eq("id", req.params.id).maybeSingle();
    if (cError) throw cError;
    if (!claim) return res.status(404).json({ error: "Request not found." });
    const donation = claim.donations;
    if (!donation || (donation.donor_id !== req.user.id && req.user.role !== "admin")) return res.status(403).json({ error: "Only the donation owner or an administrator can update this request." });
    if (status === "approved" && claim.status !== "pending") return res.status(409).json({ error: "Only pending requests can be approved." });
    if (status === "rejected" && claim.status !== "pending") return res.status(409).json({ error: "Only pending requests can be declined." });
    if (status === "completed" && claim.status !== "approved") return res.status(409).json({ error: "Approve the request before marking pickup completed." });
    if (status === "approved") {
      if (donation.status !== "available" || new Date(donation.pickup_deadline) <= new Date()) return res.status(409).json({ error: "This donation is no longer available." });
      const { data: otherApproved, error: aError } = await supabase.from("claims").select("id").eq("donation_id", donation.id).eq("status", "approved").neq("id", claim.id).maybeSingle();
      if (aError) throw aError;
      if (otherApproved) return res.status(409).json({ error: "Another request has already been approved for this donation." });
    }
    const { data: updated, error: updateError } = await supabase.from("claims").update({ status, updated_at: new Date().toISOString() }).eq("id", claim.id).select("*").single();
    if (updateError) throw updateError;
    if (status === "approved") {
      const { error } = await supabase.from("donations").update({ status: "claimed", updated_at: new Date().toISOString() }).eq("id", donation.id);
      if (error) throw error;
      await supabase.from("claims").update({ status: "rejected", updated_at: new Date().toISOString() }).eq("donation_id", donation.id).eq("status", "pending").neq("id", claim.id);
    } else if (status === "completed") {
      const { error } = await supabase.from("donations").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", donation.id);
      if (error) throw error;
    }
    res.json({ claim: updated });
  } catch (error) { next(error); }
});

module.exports = router;
