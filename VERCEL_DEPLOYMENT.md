# Vercel Deployment Guide

## Quick Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fliamwalder%2Ftest)

## Setup Steps

### 1. Deploy to Vercel

1. Click the "Deploy with Vercel" button above
2. Connect your GitHub account
3. Click "Deploy"
4. Wait for initial deployment to complete

### 2. Configure Environment Variables

**Critical:** Vercel has a read-only filesystem, so you **must** set environment variables.

Go to: **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

Add these three variables:

| Variable Name | Value | Where to Get It |
|--------------|--------|-----------------|
| `SUPABASE_URL` | `https://xxxxx.supabase.co` | Supabase Dashboard → Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | `eyJhbGc...` (long JWT) | Supabase Dashboard → Settings → API → anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGc...` (long JWT) | Supabase Dashboard → Settings → API → service_role key |

**Important:**
- ✅ Add to **all environments** (Production, Preview, Development)
- ✅ Click "Save" after adding each variable
- ✅ Values must start with `eyJ` (JWT tokens)

### 3. Redeploy

After adding environment variables:

**Option A: Via Vercel Dashboard**
1. Go to **Deployments** tab
2. Click "..." menu on the latest deployment
3. Click **"Redeploy"**

**Option B: Push to Git**
- Push any commit to your repository
- Vercel will automatically redeploy

### 4. Disable Email Confirmation in Supabase

**Before creating your admin account:**

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. **Authentication** → **Providers** → **Email**
4. **Uncheck** "Enable email confirmations"
5. Click **Save**

### 5. Run Database Migrations

1. Visit your deployed site: `https://your-site.vercel.app`
2. You'll see a setup message
3. Go to `/welcome` if not redirected
4. The wizard will show SQL to run
5. Copy the SQL
6. Go to Supabase Dashboard → **SQL Editor**
7. Paste and click **Run**

This creates:
- `pages` table
- `page_versions` table
- `assets` table
- `settings` table
- `assets` storage bucket

### 6. Create Admin Account

1. Visit `https://your-site.vercel.app/ycode`
2. You'll see a login form
3. Since no users exist yet, go back to the setup wizard
4. Complete the admin account creation
5. You'll be automatically logged in

## Verification

✅ Environment variables set in Vercel  
✅ Redeployed after setting variables  
✅ Email confirmation disabled in Supabase  
✅ Migrations run successfully  
✅ Can access `/ycode` and log in  
✅ Can create and publish pages  

## Common Issues

### "EROFS: read-only file system"

**Problem:** Tried to write to `.credentials.json` on Vercel

**Solution:** Set environment variables (see Step 2)

### "Supabase not configured"

**Problem:** Environment variables not set or not deployed

**Solutions:**
1. Double-check all 3 variables are set in Vercel
2. Make sure variables are added to correct environment
3. Redeploy after adding variables

### "Email not confirmed"

**Problem:** Email confirmation enabled in Supabase

**Solution:** Disable it (see Step 4), delete user, recreate

### Changes not appearing

**Problem:** Old deployment cached

**Solution:**
1. Go to Vercel Dashboard → Deployments
2. Find the latest deployment
3. Click "..." → Redeploy
4. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)

## Environment Variables Explained

### Why Environment Variables?

On Vercel:
- ✅ **Serverless functions** = read-only filesystem
- ✅ **More secure** = credentials encrypted by Vercel
- ✅ **Standard practice** = how serverless deployments work
- ✅ **Easy updates** = change without redeploying code

Locally:
- Uses `.credentials.json` file (gitignored)
- Easier for local development
- No need to set environment variables

### How It Works

The app automatically detects:
```typescript
const IS_VERCEL = process.env.VERCEL === '1';

if (IS_VERCEL) {
  // Use environment variables
  const url = process.env.SUPABASE_URL;
} else {
  // Use .credentials.json file
  const config = await readFile('.credentials.json');
}
```

## Custom Domain (Optional)

After successful deployment:

1. Go to Vercel Dashboard → Your Project → **Settings** → **Domains**
2. Click **Add**
3. Enter your custom domain
4. Follow DNS instructions
5. Wait for DNS propagation (can take 24-48 hours)

## Production Checklist

Before going live:

- [ ] Environment variables set correctly
- [ ] Email confirmation disabled (or SMTP configured)
- [ ] Admin account created
- [ ] Test creating/publishing pages
- [ ] Test public page access
- [ ] Test authentication (login/logout)
- [ ] Set custom domain (optional)
- [ ] Enable Vercel Analytics (optional)

## Support

If you run into issues:

1. Check Vercel Function Logs:
   - Dashboard → Your Project → **Functions**
   - Click on a function to see logs

2. Check Browser Console:
   - Press F12
   - Look for errors in Console tab

3. Open an issue:
   - [GitHub Issues](https://github.com/liamwalder/test/issues)

## Next Steps

After deployment:

1. ✅ Create your first page at `/ycode`
2. ✅ Add content using the visual builder
3. ✅ Upload images via the Assets tab
4. ✅ Publish and share your site
5. ✅ Star the repo if you find it useful! ⭐

---

**Need help?** Open an issue on [GitHub](https://github.com/liamwalder/test/issues)

