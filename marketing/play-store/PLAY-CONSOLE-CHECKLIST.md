# Google Play Console Submission Checklist

Pre-filled answers for every Play Console form. Open the console, walk down this doc top-to-bottom, paste/click as indicated.

Console URL: https://play.google.com/console
App package: `com.luminadeck.app`
Target track: **Production** (or **Internal testing** first if you want a soak)

---

## A. Listing assets — paste from disk

| Field | File / Value |
|-------|--------------|
| App name | `LuminaDeck` |
| Short description | `Turn your phone into a custom macro deck for your Windows PC` |
| Full description | paste body of `marketing/play-store/copy.md` (section 3) |
| App icon (512×512) | `marketing/play-store/hi-res-icon-512.png` |
| Feature graphic (1024×500) | `marketing/play-store/feature-graphic-1024x500.png` |
| Phone screenshots (×7, in order) | `marketing/play-store/screenshots/01..07-*.png` |
| Promo video | (optional, skip for v1.3.0) |
| Tablet screenshots | (optional, skip — phone-first product) |

**Note on captions:** Play Console doesn't support per-screenshot caption text overlays out-of-the-box — those need to be baked into the PNGs themselves. The captions in `copy.md` section 5 are recommendations if you (or a designer) later add text overlays in Photoshop/Figma. Ship without them for v1.3.0.

---

## B. Store settings → App category & contact details

| Field | Value |
|-------|-------|
| Application type | App |
| Category | Productivity |
| Tags (pick up to 5) | Productivity, Utility, Remote Control, Macro, Automation |
| Email | luminadeck@luminaaio.com |
| Phone | (optional — leave blank unless you have a support line) |
| Website | https://luminaaio.com/luminadeck |
| Privacy policy URL | https://luminaaio.com/luminadeck/privacy |

**⚠️ Privacy policy update needed before submit:** the current policy at `docs/PRIVACY-POLICY.md` says "iPhone" in several places. Either:
1. Edit the live policy at luminaaio.com/luminadeck/privacy to be platform-neutral ("phone" instead of "iPhone"), OR
2. Publish a parallel Android-specific page at luminaaio.com/luminadeck/privacy-android and use that URL here.

Google's reviewer doesn't *require* a perfect match, but mismatches trigger longer reviews.

---

## C. App content questionnaire

### Privacy policy
- URL: `https://luminaaio.com/luminadeck/privacy` (after fixing iPhone mentions per ⚠️ above)

### App access
- **Are parts of your app restricted?** → **No** (all functionality available without login)
- All functionality is available without special access.

### Ads
- **Does your app contain ads?** → **No**

### Content rating
Walk through the IARC questionnaire. For LuminaDeck answer **No** to every question on:
- Violence (any), sexuality, language, controlled substances, gambling, fear, crude humor
- User-generated content
- User interaction (in-app social, voice, location sharing)
- Digital purchases — **Yes** (Pro upgrade is an IAP)
- Personal info shared with third parties — **No**
- Location — **No**

Result will be: **Rated for 3+** (Everyone).

### Target audience and content
- **Target age group**: 18+ (productivity tool aimed at adults; reduces compliance burden)
- **Appeal to children**: No
- **Ads to children**: N/A (no ads)
- **Privacy policy applies to children**: N/A

### News app
- **Is your app a news app?** → **No**

### COVID-19 contact tracing
- **Is your app a contact-tracing app?** → **No**

### Data safety form
This is the longest form. Answers below.

**Does your app collect or share any of the required user data types?** → **No**

LuminaDeck does not collect or share user data. The data safety form requires you to confirm:
- ✅ No data collected
- ✅ No data shared with third parties
- ✅ All data is encrypted in transit (LAN WebSocket — though the local-network case is treated specially; in practice say "Yes, data is encrypted in transit" only if you're using `wss://` for the connection. If currently `ws://` plain, say **No** on encryption-in-transit — but since no data is collected, this question becomes moot.)
- ✅ Users can request data deletion (uninstall removes all local data)

If Google asks about IAP receipts: those are processed by Google Play Billing on Google's infrastructure, not collected/transmitted by your app — you're not the data controller for that flow.

### Government app
- **Is this a government app?** → **No**

### Financial features
- **Does your app have financial features?** → **No**

### Health features
- **Health Connect / Health features?** → **No**

---

## D. App release (Production / Internal testing)

### Release name
`v1.3.0 — initial Play Store release`

### Release notes
Paste from `marketing/play-store/copy.md` section 7 ("What's New — v1.3.0"). Stays under the 500-char Play Console limit.

### App bundle
Upload `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab` (after running Generate Signed Bundle in Android Studio per `docs/SETUP-ANDROID-KEYSTORE.md`).

### Countries/regions
Default: all countries available. Can restrict if you want to soft-launch in a single region first.

### Pricing
Free.

### In-app products
LuminaDeck Pro — one-time purchase. Set up under Monetization → In-app products **after** the first AAB is reviewed and you have a published listing. SKU suggestion: `pro_unlock_lifetime`. Price: $9.99 USD (Google auto-converts to local currencies).

---

## E. Pre-flight checklist (before clicking Submit)

- [ ] AAB uploaded and signed with a real release keystore (NOT debug.keystore)
- [ ] `release.keystore` and credentials backed up to password manager + offline storage
- [ ] All 6 screenshots uploaded in order
- [ ] Feature graphic uploaded
- [ ] 512×512 hi-res icon uploaded
- [ ] Privacy policy URL works in incognito and is platform-neutral
- [ ] Content rating questionnaire submitted and rating accepted
- [ ] Data safety form submitted with "no data collected" answers
- [ ] Target audience set to 18+
- [ ] Categorization: Productivity
- [ ] Email contact verified
- [ ] In-app product set up (or planned for after first listing approval)

Once all checked: **Submit for review**. Google review takes 1–7 days for a brand-new listing.

---

## F. After approval (post-launch)

- Set up in-app product `pro_unlock_lifetime` ($9.99) and link to RevenueCat
- Submit a Pre-launch report (Play Console runs your app on real devices automatically) and review the screenshots/crashes
- Monitor Vitals → Stability for ANRs and crashes
- Watch the early review queue and reply within 48h to any low-rating reviews
