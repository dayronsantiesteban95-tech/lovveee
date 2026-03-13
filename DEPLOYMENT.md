# Deployment Guide - Anika Control OS

Complete deployment runbook for production releases.

**Last Updated**: March 13, 2026

---

## Quick Deploy Commands

### Web App (Vercel)
```bash
# Auto-deploys on push to master
git push origin master

# Manual deploy (emergency)
vercel --prod
```

### Database (Supabase)
```bash
# Apply migrations
npx supabase db push

# Create new migration
npx supabase migration new feature_name
```

### Mobile App (Expo)
```bash
cd ../anika-driver-app

# iOS build
eas build --platform ios --profile preview

# Android build  
eas build --platform android --profile preview

# OTA update (JS only)
eas update --branch production --message "Fix: ..."
```

---

## Pre-Deploy Checklist

- [ ] `npm run test` passes
- [ ] `npm run typecheck` shows 0 errors
- [ ] `npm run lint` clean
- [ ] Environment variables verified

---

## Post-Deploy Verification

1. Check https://dispatch.anikalogistics.com returns 200
2. Login works
3. Real-time features work (map, BLAST)
4. Sentry shows no new errors

---

## Rollback (Vercel)

1. Go to https://vercel.com/deployments
2. Find previous working deployment
3. Click "Promote to Production"
4. Done in <1 minute

---

## Emergency Contacts

See PROJECT_README.md for current team contacts.

---

**Full Documentation**: See ENVIRONMENT.md, DATABASE.md
