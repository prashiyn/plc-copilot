# Documentation Index

Project docs, grouped by topic. (Moved out of the repo root during the v1.4→v1.5 cleanup.)

**Start here:** [RUNBOOK.md](RUNBOOK.md) — how to set up, run, and verify the app; updated as each v1.5 phase lands.

**Sysadmins / deployment:** [deployment/QUICK_START.md](deployment/QUICK_START.md) (one page) · [deployment/ADMIN_GUIDE.md](deployment/ADMIN_GUIDE.md) (full reference)

## ai/ — AI features & Claude integration
- [AI_FEATURES_README.md](ai/AI_FEATURES_README.md) — AI feature overview
- [AI_FEATURES_SUMMARY.md](ai/AI_FEATURES_SUMMARY.md) — summary of AI capabilities
- [REAL_AI_IMPLEMENTATION.md](ai/REAL_AI_IMPLEMENTATION.md) — how the live Claude routes work
- [QUICKSTART_AI.md](ai/QUICKSTART_AI.md) — getting started with the AI features
- [CLAUDE_API_MIGRATION.md](ai/CLAUDE_API_MIGRATION.md) — migration to the Anthropic SDK
- [CLAUDE_API_CREDITS_ISSUE.md](ai/CLAUDE_API_CREDITS_ISSUE.md) — API credits troubleshooting
- [VISION_AGENT_COMPLETE.md](ai/VISION_AGENT_COMPLETE.md), [VISION_AGENT_SETUP.md](ai/VISION_AGENT_SETUP.md), [VISION_CAPABILITIES.md](ai/VISION_CAPABILITIES.md) — vision agent (legacy)

## automation/ — Python PLC automation
- [AUTOMATION_APPROACHES.md](automation/AUTOMATION_APPROACHES.md) — analysis of automation methods
- **Implemented:** HTTP automation service → [FASTAPI_AUTOMATION_SERVICE.md](architecture/FASTAPI_AUTOMATION_SERVICE.md) (Phases 0–5 complete; replaces `spawn python3`)
- [COMPLETE_WORKFLOW_SUMMARY.md](automation/COMPLETE_WORKFLOW_SUMMARY.md) — end-to-end automation workflow
- [PLC_PROGRAM_GENERATION_MASTER_GUIDE.md](automation/PLC_PROGRAM_GENERATION_MASTER_GUIDE.md) — program generation guide
- [PLC_SKILL_INTEGRATION.md](automation/PLC_SKILL_INTEGRATION.md), [SKILL_SUMMARY.md](automation/SKILL_SUMMARY.md) — Claude skill integration
- [MOTOR_STARTSTOP_README.md](automation/MOTOR_STARTSTOP_README.md), [Motor_Start_Stop_TM221CE24T_LD.md](automation/Motor_Start_Stop_TM221CE24T_LD.md) — motor start/stop program
- [WIRING_AND_TESTING_GUIDE.md](automation/WIRING_AND_TESTING_GUIDE.md) — hardware install & testing
- [EcoStruxure_Machine_Expert_Basic_Programming_Guide.md](automation/EcoStruxure_Machine_Expert_Basic_Programming_Guide.md), [ECOSTRUXURE_TIMER_FORMAT.md](automation/ECOSTRUXURE_TIMER_FORMAT.md) — Schneider EcoStruxure reference
- [Dual_Tank_IO_Assignment.md](automation/Dual_Tank_IO_Assignment.md) — sample I/O assignment

## architecture/ — system design
- [FASTAPI_AUTOMATION_SERVICE.md](architecture/FASTAPI_AUTOMATION_SERVICE.md) — FastAPI sidecar design + execution plan (Phases 0–5 ✅)
- [PHASE_4_PLATFORM_INTEGRATIONS.md](architecture/PHASE_4_PLATFORM_INTEGRATIONS.md) — per-vendor export + IR pipeline; **§7.0 complete** (v1.5)
- [PHASE_5_IMPLEMENTATION.md](architecture/PHASE_5_IMPLEMENTATION.md) — **Phase 5 implementation plan** (scope limits + prioritized work + frozen tracks)
- [V1_6_IMPLEMENTATION.md](architecture/V1_6_IMPLEMENTATION.md) — **v1.6 plan ✅ delivered** (HMI generator, usage metering, P3 PID/analog, UI mock remediation; mobile deferred)
- [V1_7_PROJECTS.md](architecture/V1_7_PROJECTS.md) — **v1.7 plan** (project workspace: artefact tabs, file uploads, chat linkage, templates v2)
- [VENDOR_SCHEMA_MAINTENANCE.md](architecture/VENDOR_SCHEMA_MAINTENANCE.md) — vendor XSD registry, CI validation, field updates for older IDE versions
- [ARBITRARY_LOGIC_SYNTHESIS.md](architecture/ARBITRARY_LOGIC_SYNTHESIS.md) — Claude IR arbitrary vs constrained synthesis modes
- [E2E_INTEGRATION_AUDIT.md](architecture/E2E_INTEGRATION_AUDIT.md) — UI → BFF → FastAPI alignment audit (Phase 4/5)
- [P5_GAPS_IMPLEMENTATION.md](architecture/P5_GAPS_IMPLEMENTATION.md) — Phase 5 post-delivery gap fixes (BFF/UI alignment)
- [DIGITAL_TWIN_ARCHITECTURE.md](architecture/DIGITAL_TWIN_ARCHITECTURE.md), [SIMULATION_AND_TESTING.md](architecture/SIMULATION_AND_TESTING.md) — simulation / digital twin (see `lib/simulation/`)
- [ON_PREMISES_DEPLOYMENT.md](architecture/ON_PREMISES_DEPLOYMENT.md) — on-prem deployment
- [COMPETITIVE_ANALYSIS.md](architecture/COMPETITIVE_ANALYSIS.md) — market positioning
- [IMPLEMENTATION_SUMMARY.md](architecture/IMPLEMENTATION_SUMMARY.md) — architecture implementation summary

## deployment/
- [QUICK_START.md](deployment/QUICK_START.md) — **one-page operator bootstrap** (migrate, seed, login, verify)
- [ADMIN_GUIDE.md](deployment/ADMIN_GUIDE.md) — **sysadmin setup**: Docker stack, DB migrate/seed, demo & admin users, production checklist
- [INSTALLATION_NOTES.md](deployment/INSTALLATION_NOTES.md) — required external downloads (EcoStruxure, etc.)
- [DEPLOYMENT_STATUS.md](deployment/DEPLOYMENT_STATUS.md), [DEPLOYMENT_SUCCESS.md](deployment/DEPLOYMENT_SUCCESS.md) — Vercel deployment
- [SUPABASE_SETUP_COMPLETE.md](deployment/SUPABASE_SETUP_COMPLETE.md) — Supabase setup (configured, not yet wired in code)

## marketing/
- [SEO_ACTION_PLAN.md](marketing/SEO_ACTION_PLAN.md), [SEO_OPTIMIZATION.md](marketing/SEO_OPTIMIZATION.md), [SEO_README.md](marketing/SEO_README.md), [SEO_SUMMARY.md](marketing/SEO_SUMMARY.md) — SEO
- [LINKEDIN_MARKETING_STRATEGY.md](marketing/LINKEDIN_MARKETING_STRATEGY.md) — LinkedIn strategy

## product/
- [FEATURE_NAVIGATION_GUIDE.md](product/FEATURE_NAVIGATION_GUIDE.md) — complete feature map & routes
- [QUICK_REFERENCE.md](product/QUICK_REFERENCE.md), [QUICK_START.txt](product/QUICK_START.txt) — quick references
- [IMPLEMENTATION_SUMMARY.md](product/IMPLEMENTATION_SUMMARY.md) — web-app implementation summary
- [SESSION_SUMMARY.md](product/SESSION_SUMMARY.md) — build session notes
