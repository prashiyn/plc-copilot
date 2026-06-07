# PLCAutoPilot Supabase Quick Reference

## 🎯 Your Credentials

```env
Project ID: suhrhquytzlfgwxwdvls
Email: drmfirebase81@gmail.com
URL: https://suhrhquytzlfgwxwdvls.supabase.co
Dashboard: https://app.supabase.com/project/suhrhquytzlfgwxwdvls

Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Service Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 📁 Available SQL Files

| File | Purpose | When to Use |
|------|---------|-------------|
| `quickstart.sql` | Minimal 3 tables to get started fast | First time setup, quick testing |
| `schema.sql` | Full 14-table production schema | Complete setup, production ready |
| `storage-policies.sql` | Storage bucket access policies | After creating buckets |
| `SETUP_GUIDE.md` | Step-by-step setup instructions | Follow this first! |
| `README.md` | Complete documentation | Reference and troubleshooting |

## ⚡ Quick Setup (5 Minutes)

### 1. Run Database Schema
```
1. Open: https://app.supabase.com/project/suhrhquytzlfgwxwdvls
2. Click: SQL Editor → New Query
3. Copy: schema.sql (all contents)
4. Paste and click: Run
```

### 2. Create Storage Buckets
```
Click Storage → Create new bucket

Create 5 buckets:
✓ plc-programs (Private, 10MB)
✓ user-uploads (Private, 50MB)
✓ error-screenshots (Private, 5MB)
✓ avatars (Public, 2MB)
✓ template-thumbnails (Public, 2MB)
```

### 3. Apply Storage Policies
```
SQL Editor → New Query
Copy: storage-policies.sql
Run
```

### 4. Enable Email Auth
```
Authentication → Providers
Toggle ON: Email
Configure Site URL: http://localhost:3000
```

### 5. Test Connection
```bash
cd plcautopilot.com
npm run dev
# Visit: http://localhost:3000
```

## 🗄️ Database Schema Overview

### Core Tables (14 Total)

**User & Organization**
- `organizations` - Company accounts
- `users` - User profiles with roles

**PLC Programming**
- `projects` - PLC automation projects
- `generated_programs` - AI-generated code
- `file_operations` - Upload/download tracking

**AI & Learning**
- `error_rectifications` - Error corrections
- `learning_data` - ML training data
- `plc_recommendations` - PLC suggestions

**Communication**
- `chat_sessions` - Engineer chat rooms
- `chat_messages` - Chat message history

**Billing & Analytics**
- `usage_analytics` - Usage tracking
- `subscription_history` - Subscription changes
- `billing_transactions` - Payment records
- `api_keys` - API access tokens

## 🔐 Security Features

### Row Level Security (RLS)
✅ Enabled on all tables
✅ Users can only see their organization's data
✅ Admins have organization-wide access
✅ SuperAdmins have platform-wide access

### Storage Security
✅ Private buckets require authentication
✅ User-level folder isolation
✅ Public buckets for avatars/thumbnails
✅ File size limits enforced

## 🎨 Database Roles

| Role | Access Level | Permissions |
|------|--------------|-------------|
| **SuperAdmin** | Platform-wide | All organizations, all data |
| **Admin** | Organization | All users and projects in org |
| **User** | Project-level | Own projects and programs |

## 📊 Storage Buckets

| Bucket | Type | Size Limit | Purpose |
|--------|------|------------|---------|
| plc-programs | Private | 10 MB | Generated PLC code files |
| user-uploads | Private | 50 MB | User specifications, docs |
| error-screenshots | Private | 5 MB | OCR error captures |
| avatars | Public | 2 MB | User profile pictures |
| template-thumbnails | Public | 2 MB | Template previews |

## 🔧 Useful SQL Queries

### Check Setup Status

```sql
-- List all tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check RLS policies
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public';

-- List storage buckets
SELECT name, public
FROM storage.buckets;

-- Count users
SELECT COUNT(*) FROM users;

-- Count projects
SELECT COUNT(*) FROM projects;
```

### Create Test User

```sql
-- Via Supabase Dashboard:
-- Authentication → Users → Invite User
-- Enter email and send invite

-- Profile will be auto-created via trigger
```

### Insert Sample Data

```sql
-- Create organization
INSERT INTO organizations (name, slug, subscription_tier)
VALUES ('Test Company', 'test-company', 'professional')
RETURNING *;

-- Create project
INSERT INTO projects (
  name,
  user_id,
  organization_id,
  plc_manufacturer,
  status
)
VALUES (
  'Motor Control',
  '<user_id>',
  '<org_id>',
  'Schneider Electric',
  'draft'
);
```

## 🧪 Testing Checklist

- [ ] Schema.sql runs without errors
- [ ] All 14 tables created
- [ ] 5 storage buckets created
- [ ] Storage policies applied
- [ ] Email auth enabled
- [ ] Test user created
- [ ] Profile auto-created
- [ ] Sample organization created
- [ ] Sample project created
- [ ] API connection works from Next.js
- [ ] File upload to storage works
- [ ] RLS policies enforce security

## 🚨 Common Commands

### Database Management

```sql
-- Drop all tables (DANGEROUS!)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Disable RLS on table
ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;

-- View table structure
\d+ table_name

-- List all indexes
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public';
```

### User Management

```sql
-- Update user role
UPDATE users
SET role = 'admin'
WHERE email = 'user@example.com';

-- Check user's organization
SELECT u.email, o.name
FROM users u
JOIN organizations o ON u.organization_id = o.id;

-- Get user's project count
SELECT user_id, COUNT(*) as project_count
FROM projects
GROUP BY user_id;
```

### Analytics Queries

```sql
-- Monthly usage by organization
SELECT * FROM monthly_usage_by_org
WHERE organization_id = '<org_id>'
ORDER BY month DESC;

-- User activity summary
SELECT * FROM user_activity_summary
WHERE organization_id = '<org_id>';

-- Top users by programs generated
SELECT u.email, COUNT(gp.id) as programs
FROM users u
JOIN generated_programs gp ON u.id = gp.user_id
GROUP BY u.email
ORDER BY programs DESC
LIMIT 10;
```

## 🔗 Important Links

- **Dashboard**: https://app.supabase.com/project/suhrhquytzlfgwxwdvls
- **SQL Editor**: https://app.supabase.com/project/suhrhquytzlfgwxwdvls/sql
- **Table Editor**: https://app.supabase.com/project/suhrhquytzlfgwxwdvls/editor
- **Storage**: https://app.supabase.com/project/suhrhquytzlfgwxwdvls/storage/buckets
- **Authentication**: https://app.supabase.com/project/suhrhquytzlfgwxwdvls/auth/users
- **Database Logs**: https://app.supabase.com/project/suhrhquytzlfgwxwdvls/logs/postgres-logs
- **API Docs**: https://app.supabase.com/project/suhrhquytzlfgwxwdvls/api

## 📚 Documentation Files

1. **SETUP_GUIDE.md** - Complete step-by-step setup
2. **README.md** - Full documentation and troubleshooting
3. **QUICK_REFERENCE.md** - This file (quick commands)

## 🎯 Next Steps After Setup

1. ✅ Complete database setup
2. ✅ Test authentication flow
3. ✅ Generate first PLC program
4. ✅ Test file upload/download
5. ✅ Configure Stripe payments
6. ✅ Set up production environment
7. ✅ Deploy to Vercel

## 💡 Pro Tips

- Use `quickstart.sql` for rapid prototyping
- Use `schema.sql` for production
- Always test RLS policies with non-admin users
- Monitor database size in Settings → Database
- Enable automatic backups
- Use connection pooling for better performance
- Index frequently queried columns
- Use `EXPLAIN ANALYZE` for slow queries

## 🆘 Getting Help

- **Supabase Discord**: https://discord.supabase.com
- **Supabase Docs**: https://supabase.com/docs
- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **PLCAutoPilot Issues**: github.com/prashiyn/plc-copilot/issues

---

**Quick Start**: Follow SETUP_GUIDE.md for detailed instructions

**Environment Ready**: Your .env file is already configured ✅

**Database Ready**: Run schema.sql to create all tables ✅

**Start Coding**: npm run dev 🚀
