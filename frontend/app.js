const API = "/api";
const state = { token: localStorage.getItem("sharebite_token"), user: null, listings: [], authMode: "login" };
const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const dialog = $("#auth-dialog");

async function api(path, options = {}) {
  const headers = { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && state.token) signOut(false);
    throw new Error(payload.error || "The request could not be completed.");
  }
  return payload;
}
function toast(message) {
  const node = $("#toast"); node.textContent = message; node.classList.add("show");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove("show"), 3200);
}
function setMessage(node, message, error = false) {
  node.textContent = message; node.style.color = error ? "#a13e2d" : "var(--green)";
}
function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}
function formatDate(value) {
  if (!value) return "Not provided";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not provided" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}
function foodEmoji(category = "") {
  if (category === "Bakery") return "🥖";
  if (category === "Fruits & vegetables") return "🥦";
  if (category === "Dairy") return "🥛";
  if (category === "Packaged food") return "🥫";
  if (category === "Prepared meals") return "🍲";
  return "🍎";
}
function setAuthUi() {
  $("#open-auth").classList.toggle("hidden", !!state.user);
  $("#logout-button").classList.toggle("hidden", !state.user);
  if (state.user) {
    $("#dashboard-content").innerHTML = `<div class="dashboard-empty"><span>👋</span><p>Signed in as <strong>${escapeHtml(state.user.name)}</strong> (${escapeHtml(state.user.role)}).</p><button class="button button-outline" id="load-dashboard">Load my activity</button></div>`;
    $("#load-dashboard").addEventListener("click", loadDashboard);
  } else {
    $("#dashboard-content").innerHTML = `<div class="dashboard-empty"><span>♧</span><p>Sign in to view your dashboard.</p><button class="button button-outline" id="dashboard-signin">Sign in / create account</button></div>`;
    $("#dashboard-signin").addEventListener("click", openAuth);
  }
}
function openAuth() { $("#auth-message").textContent = ""; dialog.showModal(); }
function switchAuthMode(mode) {
  state.authMode = mode;
  $$(".auth-tab").forEach(button => button.classList.toggle("active", button.dataset.mode === mode));
  $("#register-fields").classList.toggle("hidden", mode !== "register");
  $("#auth-title").textContent = mode === "register" ? "Create your account" : "Welcome back";
  $("#auth-submit").textContent = mode === "register" ? "Create account" : "Sign in";
  $("#auth-form").elements.password.autocomplete = mode === "register" ? "new-password" : "current-password";
  $("#auth-message").textContent = "";
}
async function loadListings() {
  const status = $("#listing-status"); status.textContent = "Loading available donations…";
  try {
    const result = await api("/donations");
    state.listings = result.donations || [];
    renderListings();
  } catch (error) {
    status.textContent = `${error.message} Check your server and Supabase configuration.`;
    $("#donation-grid").innerHTML = "";
  }
}
function renderListings() {
  const query = $("#search-input").value.trim().toLowerCase();
  const category = $("#category-filter").value;
  const sort = $("#sort-filter").value;
  const items = state.listings.filter(item => {
    const haystack = `${item.title} ${item.location} ${item.description || ""} ${item.category}`.toLowerCase();
    return (!query || haystack.includes(query)) && (!category || item.category === category);
  });
  items.sort((a,b) => sort === "newest" ? new Date(b.created_at) - new Date(a.created_at) : new Date(a.pickup_deadline) - new Date(b.pickup_deadline));
  $("#listing-status").textContent = `${items.length} available donation${items.length === 1 ? "" : "s"} found`;
  const grid = $("#donation-grid");
  if (!items.length) {
    grid.innerHTML = '<div class="empty-card"><strong>No matching food listings yet.</strong><br>Try another search or check back soon.</div>'; return;
  }
  grid.innerHTML = items.map(item => `<article class="donation-card">
    <div class="card-top"><span class="food-emoji">${foodEmoji(item.category)}</span><span class="category-pill">${escapeHtml(item.category)}</span></div>
    <div class="card-body"><h3>${escapeHtml(item.title)}</h3>
      <div class="card-meta"><span>⌖ ${escapeHtml(item.location)}</span><span>◷ Pickup by ${escapeHtml(formatDate(item.pickup_deadline))}</span><span>♧ Donor: ${escapeHtml(item.donor_name || "Community donor")}</span></div>
      <p class="card-description">${escapeHtml(item.description || "A community food donation. Contact the donor through a request to coordinate pickup.")}</p>
      <p class="card-description"><strong>Allergens:</strong> ${escapeHtml(item.allergen_info || "Not provided")}</p>
      <div class="card-footer"><span class="quantity">${escapeHtml(item.quantity)}</span><button class="button button-primary request-button" data-id="${escapeHtml(item.id)}">Request food ↗</button></div>
    </div></article>`).join("");
  $$(".request-button", grid).forEach(button => button.addEventListener("click", () => requestDonation(button.dataset.id)));
}
async function requestDonation(id) {
  if (!state.user) { toast("Please sign in as a recipient to request food."); openAuth(); return; }
  if (state.user.role !== "recipient" && state.user.role !== "admin") { toast("Only recipient accounts can request donations."); return; }
  try {
    await api(`/donations/${encodeURIComponent(id)}/claims`, { method: "POST", body: JSON.stringify({}) });
    toast("Request submitted. Check your dashboard for its status.");
    await loadListings(); await loadDashboard();
  } catch (error) { toast(error.message); }
}
async function submitDonation(event) {
  event.preventDefault();
  const form = event.currentTarget, message = $("#donation-form-message");
  if (!state.user) { setMessage(message, "Please sign in with a donor account first.", true); openAuth(); return; }
  if (!["donor", "admin"].includes(state.user.role)) { setMessage(message, "Your account is a recipient. Create a donor account to list food.", true); return; }
  const data = Object.fromEntries(new FormData(form).entries());
  data.safety_confirmed = form.elements.safety_confirmed.checked;
  try {
    const result = await api("/donations", { method: "POST", body: JSON.stringify(data) });
    setMessage(message, `Donation listed successfully (reference ${result.donation.id.slice(0,8)}).`);
    form.reset(); await loadListings(); await loadDashboard(); toast("Your food donation is now listed.");
  } catch (error) { setMessage(message, error.message, true); }
}
async function loadDashboard() {
  if (!state.user) return;
  try {
    const result = await api("/dashboard");
    const donations = result.donations || [], claims = result.claims || [];
    const stats = result.stats || {};
    let html = `<div class="dashboard-grid"><div class="stat-card"><strong>${stats.donations || 0}</strong><span>My donations</span></div><div class="stat-card"><strong>${stats.claims || 0}</strong><span>Requests received / made</span></div><div class="stat-card"><strong>${stats.completed || 0}</strong><span>Completed handovers</span></div></div>`;
    if (["donor","admin"].includes(state.user.role)) {
      html += `<div class="dashboard-table-wrap"><h3>My food donations</h3><table><thead><tr><th>Food</th><th>Quantity</th><th>Pickup deadline</th><th>Status</th></tr></thead><tbody>${donations.length ? donations.map(d => `<tr><td>${escapeHtml(d.title)}</td><td>${escapeHtml(d.quantity)}</td><td>${escapeHtml(formatDate(d.pickup_deadline))}</td><td><span class="status-pill ${escapeHtml(d.status)}">${escapeHtml(d.status)}</span></td></tr>`).join("") : '<tr><td colspan="4">No donations listed yet.</td></tr>'}</tbody></table></div>`;
    }
    html += `<div class="dashboard-table-wrap"><h3>${state.user.role === "donor" ? "Requests for my donations" : "My food requests"}</h3><table><thead><tr><th>Food</th><th>Quantity</th><th>Requested by / donor</th><th>Status</th><th>Action</th></tr></thead><tbody>${claims.length ? claims.map(c => {
      const canManage = ["donor","admin"].includes(state.user.role) && c.donation_donor_id === state.user.id && c.status === "pending";
      const canComplete = ["donor","admin"].includes(state.user.role) && c.donation_donor_id === state.user.id && c.status === "approved";
      const actions = `${canManage ? `<button class="button button-outline claim-action" data-id="${escapeHtml(c.id)}" data-status="approved">Approve</button><button class="button button-outline claim-action" data-id="${escapeHtml(c.id)}" data-status="rejected">Decline</button>` : ""}${canComplete ? `<button class="button button-primary claim-action" data-id="${escapeHtml(c.id)}" data-status="completed">Mark picked up</button>` : ""}`;
      return `<tr><td>${escapeHtml(c.donation_title)}</td><td>${escapeHtml(c.donation_quantity)}</td><td>${escapeHtml(c.other_party_name || "Community member")}</td><td><span class="status-pill ${escapeHtml(c.status)}">${escapeHtml(c.status)}</span></td><td>${actions || "—"}</td></tr>`;
    }).join("") : '<tr><td colspan="5">No requests yet.</td></tr>'}</tbody></table></div>`;
    if (state.user.role === "admin") html += `<p class="muted">Administrator account: use the API/admin setup instructions in README to review platform activity.</p>`;
    $("#dashboard-content").innerHTML = html;
    $$(".claim-action").forEach(button => button.addEventListener("click", () => updateClaim(button.dataset.id, button.dataset.status)));
  } catch (error) { $("#dashboard-content").innerHTML = `<div class="empty-card">${escapeHtml(error.message)}</div>`; }
}
async function updateClaim(id, status) {
  if (!confirm(`Change this request to "${status}"?`)) return;
  try { await api(`/claims/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }) }); toast("Request updated."); await loadDashboard(); await loadListings(); }
  catch (error) { toast(error.message); }
}
async function signOut(showToast = true) {
  state.token = null; state.user = null; localStorage.removeItem("sharebite_token"); setAuthUi();
  if (showToast) toast("You have signed out.");
}
async function init() {
  $("#open-auth").addEventListener("click", openAuth);
  $("#dashboard-signin").addEventListener("click", openAuth);
  $("#logout-button").addEventListener("click", () => signOut());
  $("#donation-form").addEventListener("submit", submitDonation);
  $("#refresh-listings").addEventListener("click", loadListings);
  $("#search-input").addEventListener("input", renderListings);
  $("#category-filter").addEventListener("change", renderListings);
  $("#sort-filter").addEventListener("change", renderListings);
  $$(".auth-tab").forEach(button => button.addEventListener("click", () => switchAuthMode(button.dataset.mode)));
  $("#auth-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget, message = $("#auth-message");
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const result = await api(state.authMode === "register" ? "/auth/register" : "/auth/login", { method: "POST", body: JSON.stringify(data) });
      state.token = result.token; state.user = result.user; localStorage.setItem("sharebite_token", result.token);
      dialog.close(); form.reset(); setAuthUi(); await loadDashboard(); await loadListings(); toast(`Welcome${state.user.name ? `, ${state.user.name}` : ""}!`);
    } catch (error) { setMessage(message, error.message, true); }
  });
  if (state.token) {
    try { const result = await api("/auth/me"); state.user = result.user; }
    catch { state.token = null; state.user = null; localStorage.removeItem("sharebite_token"); }
  }
  setAuthUi(); await loadListings();
  if (state.user) await loadDashboard();
  switchAuthMode("login");
}
init();
