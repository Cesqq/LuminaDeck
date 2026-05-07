# LuminaDeck website

Minimal static site for `luminaaio.com/luminadeck/*`. Three hand-authored
pages, one shared stylesheet, zero build step. Edit the `.html` files and
upload — no framework to wrangle.

## Files

- `index.html` — landing at `/luminadeck`
- `privacy.html` — privacy policy at `/luminadeck/privacy`
- `download.html` — Windows companion download at `/luminadeck/download`
- `styles.css` — shared dark-theme stylesheet

## Deploy

### Option A — upload to existing `luminaaio.com` host

1. SFTP/SSH/web UI into whatever hosts `luminaaio.com`
2. Create `/luminadeck/` directory
3. Upload the four files into it, preserving the filenames. URLs resolve:
   - `luminaaio.com/luminadeck/` → `index.html`
   - `luminaaio.com/luminadeck/privacy` → `privacy.html`
   - `luminaaio.com/luminadeck/download` → `download.html`
   - `luminaaio.com/luminadeck/styles.css` → `styles.css`
4. On most static hosts extension-less URLs Just Work. If not, either:
   - Use `privacy/index.html` / `download/index.html` layout instead, OR
   - Add rewrite rules:
     - Nginx: `try_files $uri $uri.html =404;`
     - Apache: `RewriteRule ^(.*?)$ $1.html [L]` with check for `-f`
     - Netlify: rename files to `privacy/index.html`-style

### Option B — deploy to Netlify / Vercel / Cloudflare Pages

Drop this folder at a new site, point `luminaaio.com` at it with
`/luminadeck` as the base path. All three hosts handle pretty URLs out of
the box when pages live at `<name>/index.html`.

Easiest restructure for that pattern:
```
website/
├── luminadeck/
│   ├── index.html
│   ├── privacy/index.html
│   ├── download/index.html
│   └── styles.css
```

Rename the existing files on upload if you take this path.

## Before App Store + MS Store submission

- [ ] `https://luminaaio.com/luminadeck/privacy` returns 200
- [ ] `https://luminaaio.com/luminadeck/download` returns 200
- [ ] `https://luminaaio.com/luminadeck` returns 200
- [ ] `luminadeck@luminaaio.com` inbox exists and accepts mail (Apple + MS send
      store-ops mail to that address)
- [ ] Microsoft Store listing URL placeholder in `download.html` swapped
      for the real `apps.microsoft.com/detail/...` URL once the MS Store
      submission goes live

## Editing copy

Privacy policy content comes from `docs/PRIVACY-POLICY.md` in the repo
root — keep both in sync when making material changes (ideally edit the
markdown first, then port the HTML). App Store reviewers compare the
in-app privacy disclosure copy against the hosted page, so drift gets
flagged.
