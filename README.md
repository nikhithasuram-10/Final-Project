# Online Food Donation and Surplus Food Redistribution Platform

**ShareBite** is a beginner-friendly full-stack college project that helps food donors publish surplus food and allows recipients or charities to request it for pickup. The platform aims to reduce avoidable food waste while making donation details, pickup deadlines, and allergen/storage information easier to coordinate.

> **Food safety note:** This is a coordination tool, not a food inspection service. Donors must offer only food suitable for donation and follow applicable local food-safety rules. Recipients should confirm safe handling, temperature, ingredients and allergens before accepting food.

## 1. Objectives

- Make surplus-food listings visible to registered recipients.
- Record quantity, location, category, pickup deadline, preparation time, allergen details and storage notes.
- Allow recipient accounts to request available donations.
- Let donors approve or decline requests and mark approved pickups completed.
- Keep records in Supabase PostgreSQL rather than browser-only storage.
- Demonstrate role-based authorization, validation, REST APIs and responsive UI.

## 2. Roles

- **Donor:** creates food listings and manages requests for their own donations.
- **Recipient / charity:** browses listings and requests food.
- **Administrator:** reserved platform-management role. Public registration cannot create admin accounts; an existing trusted administrator must promote a profile manually in the database.

## 3. Features

- Responsive landing page, donation board, search and category filtering.
- Account registration and login; passwords are hashed using bcrypt.
- JWT-protected API routes and role checks on the server.
- Create food donation listings with pickup deadline and safety confirmation.
- Request a donation, prevent duplicate active requests, approve/decline requests and record completed pickup.
- User dashboard for donations and requests.
- Health endpoint, input validation, rate limiting, Helmet security headers and consistent API errors.

### Current MVP limitations

- No in-app chat, map/geolocation, notifications, transport scheduling, food verification, photo uploads or impact analytics.
- Pickup coordination occurs outside the platform after a request is approved.
- The backend uses a private Supabase service-role key and enforces access checks in Express. The service-role key bypasses database RLS; never expose it to the browser.
- A database transaction/RPC would be preferable for high-concurrency claim approvals in a production deployment. This MVP checks for another approved request, but that check and update are not atomic.
- For a production service, consider Supabase Auth, stronger session management, audit logging, rate-limit storage, transactional claim allocation, and formal food-safety/legal review.

## 4. Technology stack

- HTML5, CSS3, Vanilla JavaScript
- Node.js and Express.js
- Supabase PostgreSQL
- npm packages: `@supabase/supabase-js`, `bcryptjs`, `dotenv`, `express`, `express-rate-limit`, `helmet`, `jsonwebtoken`
- Git and GitHub

## 5. Folder structure

```text
online-food-donation-surplus-food-redistribution-platform/
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── backend/
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── donations.js
│   │   ├── claims.js
│   │   └── dashboard.js
│   ├── tests/
│   │   └── validation.test.js
│   ├── server.js
│   ├── supabase.js
│   ├── package.json
│   ├── .env
│   ├── .env.example
│   └── .gitignore
├── database/
│   └── schema.sql
├── .gitignore
└── README.md
```

## 6. Prerequisites

Install:
- [Node.js LTS](https://nodejs.org/)
- [Visual Studio Code](https://code.visualstudio.com/)
- [Git](https://git-scm.com/)
- A free Supabase project: [Supabase](https://supabase.com/)

Verify in a terminal:
```bash
node --version
npm --version
git --version
```

Node.js 20 or newer is recommended.

## 7. Supabase database setup

1. Create a Supabase project and wait for provisioning to finish.
2. In the Supabase dashboard, open **SQL Editor**.
3. Open `database/schema.sql` in VS Code, copy the entire SQL file, paste it into the SQL Editor and click **Run**.
4. Open **Table Editor** and confirm that `profiles`, `donations`, and `claims` exist.
5. Open **Project Settings → API** (or the current API/key settings page) and copy the project URL and server-side service-role/secret key. The exact labels may vary as Supabase updates its dashboard.
6. Never paste the service-role key into frontend code or commit it to GitHub.

The backend uses the service-role key only on the server. Because this key bypasses RLS, Express authorization checks are essential. The schema enables RLS but intentionally adds no anonymous table policies.

## 8. Environment configuration

Open `backend/.env` and replace the placeholder values:

```env
PORT=3000
NODE_ENV=development
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_REAL_SERVER_SIDE_KEY
JWT_SECRET=YOUR_LONG_RANDOM_SECRET
```

Generate a strong JWT secret from the **backend** directory:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Copy the output into `JWT_SECRET`. Do not share it. `backend/.env.example` documents required variable names with safe placeholders; `.env` contains your local private values and must never be committed.

## 9. Install and run

From the project root in VS Code terminal:

```bash
cd backend
npm install
npm start
```

Expected terminal message:
```text
ShareBite is running at http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000) in your browser. To check the server, visit [http://localhost:3000/api/health](http://localhost:3000/api/health). A configured server reports `"databaseConfigured": true`. This does not by itself prove that all database queries work; test registration and listings.

For development with automatic server restart:
```bash
npm run dev
```

## 10. How to use the app

1. Open the site and choose **Sign in → Create account**.
2. Register with a real email format, a password of at least eight characters, and account type **Food donor** or **Recipient / charity**.
3. A donor signs in and fills in the food donation form. A future pickup deadline and the food-safety confirmation are required.
4. A recipient signs in, browses available food and selects **Request food**.
5. The donor opens **My dashboard**, reviews the request, then approves or declines it.
6. For an approved request, the donor marks pickup completed after the handover occurs.
7. Sign out before testing another role.

The MVP does not send email, SMS or push notifications. The recipient must check their dashboard for status changes.

## 11. REST API reference

All API responses are JSON. Authenticated endpoints expect:
`Authorization: Bearer <JWT>`

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/api/health` | Public | Health and configuration status |
| POST | `/api/auth/register` | Public, rate-limited | Create donor or recipient account |
| POST | `/api/auth/login` | Public, rate-limited | Sign in and return token |
| GET | `/api/auth/me` | Signed-in user | Get current profile |
| GET | `/api/donations` | Public | List available, unexpired donations |
| POST | `/api/donations` | Donor / admin | Create a donation |
| GET | `/api/donations/:id/claims` | Donation owner / admin | View requests for one donation |
| POST | `/api/donations/:id/claims` | Recipient / admin | Request a donation |
| PATCH | `/api/claims/:id` | Donor / admin who owns donation | Approve, reject or complete a request |
| GET | `/api/dashboard` | Signed-in user | Get permitted donations/requests and summary counts |

### Request examples

Register:
```json
{
  "name": "Community Kitchen",
  "organization": "Community Kitchen",
  "email": "kitchen@example.com",
  "password": "change-this-password",
  "role": "recipient"
}
```

Create a donation (signed-in donor token required):
```json
{
  "title": "Vegetable meal boxes",
  "category": "Prepared meals",
  "quantity": "12 meal boxes",
  "location": "Main Street community center",
  "pickup_deadline": "2030-01-01T18:00:00.000Z",
  "prepared_at": "2030-01-01T12:00:00.000Z",
  "allergen_info": "Contains wheat",
  "storage_notes": "Keep refrigerated",
  "description": "Sealed meal boxes",
  "safety_confirmed": true
}
```
Use a future deadline within 14 days of submission in real testing. The example date above is illustrative only and may be rejected when it is no longer in the future.

Approve request:
```json
{ "status": "approved" }
```
Allowed status changes are `approved`, `rejected`, and `completed`; transitions are validated by the backend.

## 12. Testing checklist

| Test | Steps | Expected result |
|---|---|---|
| Health endpoint | Open `/api/health` | JSON health status |
| Database configured | Check health response | `databaseConfigured: true` when env values are present |
| Registration | Create donor and recipient accounts | Account created; token returned |
| Duplicate email | Register same email twice | HTTP 409 error |
| Invalid password | Register with fewer than 8 characters | HTTP 400 error |
| Login | Use correct account credentials | Token returned |
| Invalid login | Wrong password | Generic HTTP 401 error |
| Browse donations | Open Discover food | Only available, future-deadline listings appear |
| Create donation | Submit complete donor form | Listing saved to PostgreSQL |
| Missing safety confirmation | Submit without confirmation | Frontend blocks; API rejects false value |
| Recipient request | Request an available donation | Pending request created |
| Duplicate request | Request the same donation again | Duplicate active request rejected |
| Donor permissions | Try to create a listing as recipient | HTTP 403 error |
| Approval | Donor approves pending request | Claim approved and donation becomes claimed |
| Completion | Donor marks approved claim completed | Claim and donation record completion |
| Search/filter | Search for a word or category | Results update |
| Responsive layout | Resize browser to mobile width | Layout adapts to smaller screens |
| Invalid/expired token | Call a protected endpoint with an invalid token | HTTP 401 error |

Run included lightweight tests:
```bash
cd backend
npm test
```
These are basic logic checks, not a substitute for end-to-end testing with your own Supabase project.

## 13. Troubleshooting

- **`Database is not configured`:** check `backend/.env` and restart the server after changes.
- **Health shows `databaseConfigured: false`:** ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are filled in correctly.
- **Database/table error:** rerun `database/schema.sql` and confirm all three tables and the foreign keys exist.
- **Invalid API key / 401 from Supabase:** use the correct server-side key for the same Supabase project as the URL.
- **Registration fails unexpectedly:** check the backend terminal for a concise error and verify the SQL schema was run. Do not expose private credentials when asking for help.
- **Port 3000 is busy:** change `PORT` in `backend/.env` and restart.
- **Page loads but listings fail:** open `/api/health`, inspect the terminal and browser developer console, then verify database credentials.
- **Sign-in expires:** JWTs expire after eight hours; sign in again.
- **Blank/old page:** hard-refresh the browser and confirm `frontend/app.js` is loaded.
- **Unsafe secret committed:** rotate it immediately; removing it from `.gitignore` is not enough if it was already committed.

## 14. Git and GitHub upload

From the **project root** (not the `backend` directory):

```bash
git init
git status
git add .
git status
git commit -m "Build ShareBite food redistribution platform"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

Replace `YOUR_GITHUB_REPOSITORY_URL` with your repository's actual URL. Before `git add .`, inspect `git status` and confirm `backend/.env`, `node_modules/`, exports and private data are not staged. `.env.example` should be included. If a secret was committed, rotate it immediately and clean repository history as needed.

## 15. Security and future improvements

- Passwords are hashed; passwords and password hashes are not returned to the frontend.
- JWT tokens expire after eight hours; auth endpoints are rate-limited.
- Backend routes verify identity and role before privileged operations.
- The private Supabase key is read only from server environment variables.
- Inputs are length-checked and database constraints restrict roles, categories and statuses.
- For a public production service, add atomic database functions for request approval, more robust refresh/session handling, audit logs, operational monitoring, privacy/legal review and an approved food-safety workflow.
- Consider pickup notifications, verified charities, map-based discovery, donation photos, volunteer delivery scheduling, impact reports and multilingual support.

## 16. Final verification checklist

- [ ] `frontend/`, `backend/`, and `database/` directories are present.
- [ ] `README.md` and `.gitignore` are in the project root.
- [ ] SQL schema creates `profiles`, `donations`, and `claims`.
- [ ] `.env` values belong to your own Supabase project and are not committed.
- [ ] `npm install` and `npm start` run from `backend/`.
- [ ] `/api/health` responds.
- [ ] Registration, login, listing, request and approval workflows are tested.
- [ ] Donor and recipient permissions are tested with separate accounts.
- [ ] GitHub repository does not contain private credentials.

**Note:** The source package is prepared for your own Supabase configuration. Remote database connectivity and full browser workflows must be tested in your environment.
