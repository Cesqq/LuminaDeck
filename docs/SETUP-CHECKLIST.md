# LuminaDeck - Setup Checklist & Credentials

Fill in each section as you complete it. Once done, hand this back and we start building.

---

## PRIORITY 1: DO NOW (Blockers)

### Apple Developer Program
- [ ] Enrolled at developer.apple.com/programs ($99/yr)
- Status: _______________  (pending / approved / rejected)
- Apple Team ID: _______________
- Bundle ID chosen: com.luminadeck._______________  (e.g., "app")
- Apple ID email used: _______________

### Mac Access
- [ ] Secured Mac access for Xcode / iOS builds
- Method: _______________  (own Mac / Mac Mini / MacStadium cloud / other)
- macOS version: _______________
- Xcode installed: [ ] yes  [ ] no

### EV Code Signing Certificate (Windows)
- [ ] Ordered from: _______________  (DigiCert / Sectigo / GlobalSign / other)
- Order date: _______________
- Estimated delivery: _______________
- Received: [ ] yes  [ ] no

---

## PRIORITY 2: THIS WEEK (Quick Setups)

### Supabase
- [ ] Project created at supabase.com
- Project name: _______________
- Region: _______________
- SUPABASE_URL: _______________
- SUPABASE_ANON_KEY: _______________
- SUPABASE_SERVICE_ROLE_KEY: _______________

### Expo / EAS
- [ ] Account created at expo.dev
- Username: _______________
- EXPO_ACCESS_TOKEN: _______________

### Node.js
- [ ] Installed on Windows
- Version: _______________  (need v20+)
- Verify: run `node --version` in terminal

### Rust Toolchain (for Tauri evaluation)
- [ ] Installed via rustup.rs
- Version: _______________
- Verify: run `rustc --version` in terminal

---

## PRIORITY 3: CAN WAIT (Phase 4+)

### Stripe
- [ ] Account created at stripe.com
- STRIPE_PUBLISHABLE_KEY: _______________
- STRIPE_SECRET_KEY: _______________

### Snyk (optional)
- [ ] Account created at snyk.io
- SNYK_TOKEN: _______________

---

## HARDWARE CHECKLIST

### Development Machine (Windows)
- [ ] Windows 10 21H2+ or Windows 11
- OS version: _______________
- Node.js: [ ] installed
- Git: [ ] installed
- Cursor: [ ] installed

### Mac (for iOS builds)
- [ ] Available
- Model: _______________
- macOS version: _______________
- Xcode: [ ] installed
- CocoaPods: [ ] installed  (run: sudo gem install cocoapods)

### iPhone (for testing)
- [ ] Available
- Model: _______________  (iPhone 12 or newer)
- iOS version: _______________  (need iOS 16+)

---

## EXISTING TOOLS (confirm access)

- [ ] Claude Max (20x) -- you're using it now
- [ ] Cursor -- IDE
- [ ] ChatGPT Pro / Codex
- [ ] Canva
- [ ] KlingAI
- [ ] ElevenLabs
- [ ] Lovable
- [ ] Antigravity

---

## DECISIONS NEEDED BEFORE WEEK 1

1. **Bundle ID**: What do you want after "com.luminadeck."?
   - Suggestion: `com.luminadeck.app`
   - Your choice: _______________

2. **App Display Name on App Store**: 
   - "LuminaDeck" or something else?
   - Your choice: _______________

3. **Landing page domain**: Do you own a domain? 
   - Domain: _______________
   - If not, suggestions: luminadeck.app / luminadeck.io / getluminadeck.com

4. **GitHub repo visibility**: 
   - [ ] Private (recommended)
   - [ ] Public / open-source

---

## DO NOT SHARE THESE WITH ANYONE

Once filled in, keep this file LOCAL ONLY. When you're ready, paste the
keys into the .env file I'll set up -- never commit this document or the
.env file to git.

---

**When you've completed Priority 1 and 2, let me know and we start Phase 0.**
