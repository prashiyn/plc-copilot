# SEO Optimization — Change Documentation

**Project:** PLCAutoPilot
**Date:** 2026-06-02
**Scope:** On-page SEO fixes for the public site, driven by an SEOptimer-style audit
**Commit:** `254dfc6` — "SEO: optimize home page metadata, social links, analytics, llms.txt"

---

## 1. Overview

This document records the SEO changes made to the PLCAutoPilot Next.js application
during the 2026-06-02 optimization session. Each item below was triggered by a
specific finding in an external SEO audit tool, fixed in code, and verified on the
local dev server (`http://localhost:3001`).

All nine fixes are committed locally on `main`. They become visible to the external
SEO checker only after the site is **deployed**, because the checker scans the live
production site (`https://plcautopilot.com`), not localhost.

---

## 2. Summary of Changes

| # | SEO Check | Before | After | File(s) |
|---|-----------|--------|-------|---------|
| 1 | Title tag length | 77 chars | 57 chars | `app/layout.tsx` |
| 2 | Meta description length | 265 chars | 156 chars | `app/layout.tsx` |
| 3 | Open Graph / Twitter tags | Stale wording | Aligned with new title/description | `app/layout.tsx` |
| 4 | Hreflang | Missing | `en-US` + `x-default` | `app/page.tsx` |
| 5 | Canonical tag | Missing | Self-referencing canonical | `app/page.tsx` |
| 6 | Analytics | None detected | Google Analytics 4 | `app/layout.tsx`, `.env.example`, `package.json` |
| 7 | llms.txt | Missing | Added at `/llms.txt` | `public/llms.txt` |
| 8 | PageSpeed (FCP/LCP) | Render-blocking font | Preconnect + `display=swap` | `app/layout.tsx` |
| 9 | X (Twitter) account link | Not linked | Footer link + `sameAs` schema | `app/components/Footer.tsx`, `app/layout.tsx` |

---

## 3. Detailed Changes

### 3.1 Title Tag (50–60 character target)

**Finding:** Title was 77 characters; recommended 50–60.

**Before:**
```
PLCAutoPilot - AI-Powered PLC Programming Assistant | Ladder Logic Automation
```

**After (57 chars):**
```
PLCAutoPilot: AI PLC Programming & Ladder Logic Generator
```

**Location:** `app/layout.tsx` — `metadata.title.default`

Keeps the brand name front-loaded and retains the primary keywords
"PLC Programming" and "Ladder Logic".

---

### 3.2 Meta Description (150–160 character target)

**Finding:** Description was 265 characters; recommended 120–160.

**Before (265 chars):**
```
Transform PLC specifications into production-ready ladder logic code in minutes.
AI-powered automation for Schneider Electric Modicon M221, M241, M251, M258,
M340, M580. Support for Machine Expert, Control Expert, and Vijeo Designer.
Reduce development time by 80%.
```

**After (156 chars):**
```
Transform PLC specs into production-ready ladder logic in minutes with AI.
Automation for Schneider Electric Modicon M221-M580. Cut development time by 80%.
```

**Location:** `app/layout.tsx` — `metadata.description`

---

### 3.3 Open Graph & Twitter Tags

**Finding:** The SERP snippet preview showed the old title/description because the
`openGraph` and `twitter` blocks still held the pre-optimization wording.

**Change:** Set `openGraph.title`, `openGraph.description`, `twitter.title`, and
`twitter.description` to match the new optimized title and description so all
social/search surfaces are consistent.

**Location:** `app/layout.tsx` — `metadata.openGraph`, `metadata.twitter`

---

### 3.4 Hreflang

**Finding:** Page had no `hreflang` attributes.

**Change:** Added a self-referencing hreflang set on the home page. Placed on the
home page (not the root layout) so child routes do not incorrectly inherit the home
URL as their alternate.

```ts
// app/page.tsx
export const metadata: Metadata = {
  alternates: {
    canonical: '/',
    languages: {
      'en-US': '/',
      'x-default': '/',
    },
  },
};
```

**Rendered output:**
```html
<link rel="alternate" hrefLang="en-US" href="https://plcautopilot.com"/>
<link rel="alternate" hrefLang="x-default" href="https://plcautopilot.com"/>
```

---

### 3.5 Canonical Tag

**Finding:** Page was not specifying a canonical URL.

**Change:** Added `alternates.canonical: '/'` to the home page metadata (same object
as the hreflang change above).

**Rendered output:**
```html
<link rel="canonical" href="https://plcautopilot.com"/>
```

---

### 3.6 Analytics — Google Analytics 4

**Finding:** No analytics tool detected on the page.

**Change:**
- Installed `@next/third-parties`.
- Added the GA4 component to the root layout, reading the Measurement ID from an
  environment variable with a placeholder fallback:
  ```tsx
  // app/layout.tsx
  import { GoogleAnalytics } from "@next/third-parties/google";
  ...
  <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID || "G-XXXXXXXXXX"} />
  ```
- Documented the variable in `.env.example`:
  ```
  NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
  ```

**Action required:** Set a real `NEXT_PUBLIC_GA_ID` (from GA Admin > Data Streams)
locally in `.env.local` and in the Vercel project environment variables. Until then
the gtag script loads with a placeholder ID and does not record real traffic.

---

### 3.7 llms.txt

**Finding:** No `llms.txt` file detected.

**Change:** Created `public/llms.txt` (served at `/llms.txt`) following the llms.txt
standard — an H1 title, a blockquote summary, and sections linking to the main pages
and blog guides.

---

### 3.8 PageSpeed — Font Loading (FCP / LCP)

**Finding:** Mobile PageSpeed score 82; First Contentful Paint 3.4s and Largest
Contentful Paint 3.7s. The Material Icons stylesheet was a render-blocking external
request.

**Change:** Added preconnect hints and `display=swap`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
<link href="https://fonts.googleapis.com/icon?family=Material+Icons&display=swap" rel="stylesheet" />
```

**Location:** `app/layout.tsx` — `<head>`

> Note: The audit's "Avoid multiple page redirects" opportunity is a domain/hosting
> redirect chain (configured in Vercel domain settings), not a code change.

---

### 3.9 X (Twitter) Account Link

**Finding:** No X profile linked on the page.

**Change:**
- Added a social links row (X + GitHub icons) to the footer brand column.
- Added the X profile to the Organization JSON-LD `sameAs` array.

The handle `@plcautopilot` was already declared in the existing Twitter card config,
so no new value was invented.

**Locations:** `app/components/Footer.tsx`, `app/layout.tsx`

**Action required:** Confirm `https://x.com/plcautopilot` is the correct account.

---

## 4. Files Changed

```
.env.example                 # NEXT_PUBLIC_GA_ID documented
app/layout.tsx               # title, description, OG/Twitter, GA4, preconnect, sameAs
app/page.tsx                 # hreflang + canonical
app/components/Footer.tsx    # X + GitHub social links
package.json                 # @next/third-parties dependency
package-lock.json            # dependency lock
public/llms.txt              # new file
```

---

## 5. Verification (Local)

Run the dev server and inspect the rendered tags:

```bash
npm install
npm run dev          # serves on http://localhost:3000 (or 3001 if 3000 is busy)
```

Then check the home page source:

| Tag | Expected |
|-----|----------|
| `<title>` | PLCAutoPilot: AI PLC Programming & Ladder Logic Generator |
| `meta[name=description]` | 156-char optimized description |
| `og:title` / `twitter:title` | Same as `<title>` |
| `link[rel=canonical]` | https://plcautopilot.com |
| `link[rel=alternate][hreflang]` | en-US and x-default |
| gtag script | googletagmanager.com/gtag/js?id=... |
| `/llms.txt` | HTTP 200 |
| footer | X + GitHub links present |

---

## 6. Deployment

These changes are visible to the external SEO checker only after deployment, because
the checker scans the live production site, not localhost.

1. Commit and push to `main` (commit `254dfc6` is already created locally).
2. If the repo is connected to Vercel, the push auto-deploys from `main`.
3. Re-run the SEO checker against `https://plcautopilot.com`.

> Push note: this machine had no GitHub credentials configured. Complete the push in
> an interactive terminal (`git push origin main`) so Git Credential Manager can
> authenticate, or configure a Personal Access Token / the GitHub CLI.

---

## 7. Not Addressed (Requires External Data or Action)

These audit items cannot be fixed by editing the codebase:

| Item | Why it is out of code scope | Owner action |
|------|-----------------------------|--------------|
| Facebook Page link | No real URL available | Provide URL, then add to footer + `sameAs` |
| Instagram / LinkedIn / YouTube links | No real URLs available | Provide URLs |
| Facebook Pixel | Needs Meta Pixel ID; only for Meta ads | Provide ID if advertising |
| Address & Phone | Needs real business NAP data | Provide address + phone |
| Local Business Schema | Not applicable to a SaaS product | Skip (Organization + SoftwareApplication already present) |
| Google Business Profile (+ Reviews) | External Google listing | Create on google.com/business |
| DMARC record | DNS TXT record, not website code | Add at DNS provider (Namecheap) |
| HTTP/2, redirect chain | Hosting/CDN setting | Handled automatically by Vercel after deploy |
| AMP | Deprecated by Google; harmful to a React app | Skip intentionally |

**Informational audit panels (no defect, no action):** AI Overview Citations,
Device Rendering, Core Web Vitals (needs real traffic), Resources Breakdown,
Technology List, Server/DNS info.

---

*Generated 2026-06-02 — PLCAutoPilot SEO optimization session.*
