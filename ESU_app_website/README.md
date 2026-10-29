# PayRight

Scan before you pay. Know what every rupee is for.

| Folder / file | What it is |
|---|---|
| `index.html`, `*.html`, `assets/` | The PayRight website — brand story, bill checker, consumer-rights hub, pricing, about, legal, login |
| `app/` | The PayRight mobile app — scan, audit, split, groups, explore, complaints, Ask PayRight, profile |
| `bills/` | Bill PDFs to upload in the app or on the website |
| `Open PayRight on Phone.command` | Opens the app on your phone over Wi-Fi with a QR code |

## How to open

**On a Mac or laptop**
- Website: double-click `index.html`
- App: double-click `app/index.html`

**On a phone**

1. **Same Wi-Fi**
   - Double-click **`Open PayRight on Phone.command`** (if macOS asks to allow incoming connections, click *Allow*)
   - Scan the QR code that appears with your phone's camera
   - Add it to the home screen: **iPhone (Safari)** Share → *Add to Home Screen* · **Android (Chrome)** ⋮ → *Add to Home screen / Install app*
   - Open **PayRight** from the home screen — it runs full-screen with its own icon
   - If the college Wi-Fi blocks the connection, turn on your phone's hotspot, connect the Mac to it, and run the launcher again
2. **Online link (GitHub Pages)**
   - Upload everything in this folder to the root of a GitHub repo
   - Repo → Settings → Pages → Source: *Deploy from a branch* → `main` / `(root)` → Save
   - Website: `https://<username>.github.io/<repo>/` · App: `https://<username>.github.io/<repo>/app/`
   - Log in / "Open the app" on the website goes to the app automatically
   - Open the app link on any phone and add it to the home screen

An internet connection is needed for the fonts and the website's smooth scrolling.

## Presentation flow

1. Website home → scroll through "How it works", the features and "Beyond restaurants"
2. Website → **Check a bill** → pick the hospital bill, or **Upload a bill PDF** from the `bills/` folder
3. App → **Scan** → **Upload bill PDF** → `07-hospital-sunrise-inpatient-hidden-charges.pdf` → Check the details → Run audit
4. On the audit → **Split this bill** → tap avatars to assign items → Add to a group → Settle
5. Show **Ask PayRight**, **Complaints**, **Explore** and **Profile** (light / dark)

**Profile → Reset app** restores the starting bills, groups and complaints.

## Bills

| File | What PayRight finds |
|---|---|
| 01 restaurant – Coastal Table | All maths correct · service charge is optional |
| 02 café – Brew & Bloom | Subtotal ₹40 too high → ₹42 overcharge |
| 03 restaurant – Tandoor Lane | Butter Naan billed twice · packaging fee on dine-in |
| 04 restaurant – Seabreeze | GST charged on the service charge |
| 05 delivery – Urban Bites | Fees check out · platform fee needs the checkout screen |
| 06 café – Chai Tapri | Everything correct |
| 07 hospital – Sunrise | 4 room-rent days for a 3-night stay · duplicate CBC test · medicine above MRP · unitemised admin/misc charges |
| 08 clinic – CityCare | GST on healthcare · unexplained convenience charge |
| 09 grocery – Green Basket | Rice above MRP · carry-bag charge |
| 10 hospital – Lifeline day care | Everything correct |
| 11 hospital – Metro Heart | ECG line total wrong → ₹200 overcharge · unitemised nursing/service charge |
