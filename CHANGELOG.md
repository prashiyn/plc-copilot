# Changelog

All notable changes to PLCAutoPilot will be documented in this file.

## [1.7.0] - 2026-06-16

### Added
- **Project workspace** — tabbed `/projects/[id]` page with Overview, Programs, HMI, Files, Chats, Notes, Rectifications, and Recommendations
- **Project linkage** — optional `ProjectSelector` on generator, HMI, rectify, PLC selector, and chat tools; artefacts persist with `projectId`
- **File uploads** — per-project attachments via `POST /api/projects/[id]/files` with `lib/storage.ts` (50 MB, MIME allowlist)
- **Chat linkage** — AI Co-Pilot and Engineer Chat sessions linked to projects with read-only replay
- **Templates v2** — `POST /api/projects/from-template` creates a real project; templates page redirects to workspace with generator quick-action
- **`/projects` landing** — active/completed hub with new-project modal (fixes sidebar 404)
- **Seed data** — Motor Start/Stop Demo and PID Temperature Control sample projects after `db:seed`
- **Overview enhancements** — cover image upload, recent activity feed (`GET /api/projects/[id]/activity`), markdown note rendering
- **Tests** — `lib/projects.test.ts`, `lib/projects-api.test.ts`, storage/markdown/activity/upload unit tests

### Changed
- Dashboard project links point to `/projects` landing
- `package.json` version → `1.7.0`

### Deferred (unchanged — v1.8+)
- Custom project templates DB (E2 stretch), `project_activity` dedicated audit table, SAP/collaboration/versioning/zip export, Stripe `maxProjects` gating

### Verify
```bash
npm run test:plc && npm run build
npm run db:migrate && npm run db:seed
```

## [1.6.0] - 2026-06-16

### Added
- **PID / analog logic (P3)** — `CompareNode`, `FbCallNode`, `pid_loop` pattern; NL detection; multi-vendor export (Siemens SCL, Mitsubishi ST/IL, Schneider M221, PLCopen, Rockwell L5X); generator setpoint field
- **HMI generator (real)** — `HmiService` + `POST /v1/ai/hmi/generate`; BFF `/api/hmi-generate`; vendor-aware scripts + tag CSV zip; optional tag prefill from saved PLC IR
- **Usage metering** — `recordUsage()` on all AI/generation BFF routes; `GET /api/usage`; plan limits (`lib/billing/plan-limits.ts`); dashboard + billing usage/plan pages wired; soft over-limit warnings
- **Settings APIs** — profile, preferences, notifications, password, API keys (`users.preferences` jsonb)
- **Support** — contact form + ticket CRUD (`support_messages`, `support_tickets` tables)
- **Resources** — markdown docs (`content/docs/`), tutorials registry, forum threads API; docs `[slug]` detail page
- **Project templates** — `GET /api/templates` (10 patterns incl. `pid_loop`); generator URL prefill from templates/examples

### Changed
- **UI mock remediation** — settings, support, resources, templates, HMI, and usage meters no longer use `setTimeout`/hardcoded placeholders on shipped paths
- **Docs** — `V1_6_IMPLEMENTATION.md`, refreshed `E2E_INTEGRATION_AUDIT.md`, `FEATURE_NAVIGATION_GUIDE.md`, P3 PID note in `PHASE_5_IMPLEMENTATION.md`
- **package version** — `1.6.0`

### Deferred (unchanged — v1.7+)
- Mobile app (React Native), Stripe checkout, SAP RFC/OData, simulator HMI preview, session list / 2FA on security page

### Verify
```bash
cd automation && uv run pytest api/tests -q   # 403
npm run test:plc && npm run build             # 90 passed
docker compose up -d && npm run db:migrate    # Phase D support/forum tables
```

---

## [1.5.0] - 2026-06-16

### Added
- **FastAPI automation service** — Redis job worker, program generate/export, sketch analyze, M221 AI, recommend/rectify routes
- **Multi-vendor export** — Schneider Calaos, Rockwell L5X, Siemens SCL, Mitsubishi IL/ST, PLCopen XML; nine deterministic patterns + Claude IR synthesis
- **Phase 5 gaps** — BFF tier2/plcopen routing for all patterns; generator advanced Claude IR panel; rectify-error UI; E2E recommend/library fixes
- **E2E follow-ups** — Generated programs list (`/programs`), sketch generator page, catalog-backed solution compare, `GET /api/plc-catalog`

### Changed
- **Auth + persistence** — Auth.js v5, Drizzle/Postgres for projects, programs, dashboard stats
- **AI routes** — Live Claude proxies via automation service (replaced mock TS generators on production paths)
- **Docs** — `PHASE_5_IMPLEMENTATION.md`, `P5_GAPS_IMPLEMENTATION.md`, `E2E_INTEGRATION_AUDIT.md`, Runbook

### Removed
- Orphan duplicate BFF routes (`/api/ai-copilot`, `ai-application-generator`, `ai-library-manager`, `ai-code-optimizer`)

### Changed (v1.5 final)
- **AI prompts in Python** — `ai_prompts.py` + `AiCopilotService`; BFF routes are thin proxies to `/v1/ai/copilot|engineer|application|library|code/*`
- **package version** — `1.5.0`

### Verify
```bash
cd automation && uv run pytest api/tests -q   # 339+
npm run test:plc && npm run build
```

---

## [1.4.0] - 2025-12-22

### Added
- **Multi-Platform Support Section**: New dedicated section showcasing support for ALL major PLC platforms
  - The Big Three: Siemens (35% global), Rockwell/Allen-Bradley (25% global), Mitsubishi (15% global)
  - CODESYS Universal Coverage: 500+ PLC brands including Schneider, ABB, WAGO, Festo, Eaton
  - Competitive advantages section highlighting market position

- **Comprehensive Services Section**: Four service categories
  - Dealing: Hardware/software sales, partnerships
  - Development: Custom PLC programming, system integration
  - Consulting: All automation industry solutions
  - Custom Solutions: Tailored to specific customer needs

### Changed
- **Hero Section**: Updated messaging to emphasize multi-platform support
  - Changed from "Schneider Electric EcoStruxure platforms" to "ALL major PLC platforms"
  - Now mentions Siemens, Rockwell, Mitsubishi, Schneider, and 500+ CODESYS brands

- **Positioning**: Repositioned as "The ONLY AI Tool for ALL Major PLC Platforms"
  - Competitive advantage over single-brand tools
  - 95%+ market coverage
  - Universal workflow across all platforms

### Technical
- Created new components: `MultiPlatform.tsx`, `Services.tsx`
- Updated `Hero.tsx` with multi-platform messaging
- Updated `page.tsx` to include new sections in proper order
- Fixed ESLint apostrophe error
- Build time: ~5-6 seconds
- All 14 pages generated successfully

### Deployment
- Deployed to Vercel production
- URL: https://www.plcautopilot.com
- Cache status: HIT (edge-cached)
- Response time: <200ms

---

## [1.3.0] - 2025-12-22

### Changed
- Updated footer version format
- Standardized version numbering (v1.3)
- Static date format: December 22, 2025
- GitHub link format updated

### Fixed
- Footer version consistency across deployments

---

## [1.2.0] - 2025-12-22

### Added
- Claude Code master autonomy configuration (`.claude/claude.md`)
- Full autonomy rules and operating procedures
- 200+ step comprehensive task approach
- Multi-platform PLC support guidelines
- Auto-confirm subagent configuration
- Version management system

### Documentation
- Complete autonomy documentation
- Quality bars and deliverables checklist
- Task management guidelines

---

## [1.1.0] - 2025-12-22

### Added
- Installation notes for excluded files
- Documentation for EcoStruxure Machine Expert Basic download
- Python requirements documentation

### Changed
- Excluded large executable files from Git (695 MB installer)
- Updated `.gitignore` for executable files

---

## [1.0.0] - 2025-12-21

### Added
- Initial Next.js 15 web application
- Complete landing page with all sections:
  - Hero with code example
  - Problem statement
  - Solution overview
  - Features showcase (6 core capabilities)
  - Platform support section
  - Team section
  - Testimonials
  - Pricing (3 tiers)
  - Compliance section
  - CTA and Footer

- Blog system with 6 posts:
  - PLC Programming Tutorial
  - Ladder Logic Complete Guide
  - HMI/SCADA Integration
  - IEC 61508 Safety Standards
  - Universal PLC Programming Guide
  - AI in PLC Programming

- Platform-specific pages:
  - M241, M251, M258, M340, M580

- SEO optimization:
  - Comprehensive metadata
  - Structured data (JSON-LD)
  - Open Graph tags
  - Twitter Cards
  - Sitemap and robots.txt
  - 27+ target keywords

### Technical
- Next.js 15.5.9
- React 19.0.0
- TypeScript 5
- Tailwind CSS 3.4.1
- Framer Motion 11.15.0
- 100% static site generation
- Vercel deployment ready

---

## Next Steps

> **v1.6 shipped** (2026-06-16) → [V1_6_IMPLEMENTATION.md](docs/architecture/V1_6_IMPLEMENTATION.md). Deferred product work → [PHASE_5_IMPLEMENTATION.md](docs/architecture/PHASE_5_IMPLEMENTATION.md) §5 frozen tracks.

### Planned Features (v1.7+)
- [ ] Mobile app (React Native)
- [ ] Stripe payment processing & subscription checkout
- [ ] Real SAP RFC/OData integration
- [ ] Siemens TIA Portal integration
- [ ] Rockwell Studio 5000 support
- [ ] Mitsubishi GX Works integration
- [ ] CODESYS universal adapter
- [ ] Interactive code playground
- [ ] Live demo with PLC simulator
- [ ] Multi-language support (German, Japanese, Spanish)
- [ ] Video tutorials section
- [ ] API documentation

### Technical Improvements
- [ ] Unit tests for all components
- [ ] E2E tests with Playwright
- [ ] Performance monitoring
- [ ] A/B testing framework
- [ ] Analytics integration
- [ ] Contact form backend
- [ ] Newsletter subscription
- [ ] User authentication system

### Content Additions
- [ ] Case studies section
- [ ] White papers library
- [ ] Webinar recordings
- [ ] Certification program
- [ ] Partner ecosystem page
- [ ] Job board for PLC engineers

---

**Version Format**: MAJOR.MINOR.PATCH
- MAJOR: Breaking changes or major new features
- MINOR: New features, backward compatible
- PATCH: Bug fixes and minor improvements

**Update Frequency**: Every Git push increments version
**Footer Format**: PLCAutoPilot vX.X | Last Updated: Month DD, YYYY | github.com/prashiyn/plc-copilot
