# YCode Auto-Update System 🔄

## Overview

YCode now includes an **automatic update notification system** that makes it easy for users to keep their installation up-to-date with the latest features and fixes from the official repository.

## Features

✨ **Automatic Version Checking**
- Checks for updates hourly
- Compares with GitHub releases
- Detects your deployment method

🎯 **Smart Update Instructions**
- Detects if you're using GitHub + Vercel
- Shows personalized update steps
- Provides one-click update button (when possible)

🎨 **Beautiful UI**
- Fixed banner at top of `/ycode` builder
- Dismissible (temporarily)
- Shows version info and release notes
- Animated icons

## User Experience

### When Update Available

A banner appears at the top of the `/ycode` builder:

```
🎉 New YCode update available!
Version 1.2.0 is now available (you have 1.0.0)

[Sync Update]  [How to Update]  [×]
```

### GitHub + Vercel Deployment (Best Experience)

If deployed via GitHub fork + Vercel:

1. **Click "Sync Update"** button
2. Opens GitHub sync page in new tab
3. Click "Update branch" on GitHub
4. Vercel auto-deploys ✨
5. Done!

### Manual Git Deployment

If using git pull method:

1. Click "How to Update"
2. See step-by-step terminal commands
3. Copy and paste
4. Push to trigger redeploy

## How It Works

### 1. Version Detection

```typescript
// Reads from package.json
const CURRENT_VERSION = packageJson.version; // e.g., "1.0.0"
```

### 2. Update Check API

**Endpoint:** `GET /api/updates/check`

**What it does:**
- Fetches latest release from GitHub
- Compares versions using semantic versioning
- Detects deployment environment (Vercel vars)
- Returns personalized update instructions

**Response:**
```json
{
  "available": true,
  "currentVersion": "1.0.0",
  "latestVersion": "1.2.0",
  "releaseUrl": "https://github.com/...",
  "releaseNotes": "## What's New...",
  "updateInstructions": {
    "method": "github-sync",
    "steps": [
      "Go to your GitHub repository",
      "Click 'Sync fork'",
      "Click 'Update branch'",
      "Vercel will auto-deploy"
    ],
    "autoSyncUrl": "https://github.com/user/repo/compare/..."
  }
}
```

### 3. Update Notification Component

Located at: `components/UpdateNotification.tsx`

**Features:**
- Checks for updates on mount
- Re-checks every hour
- Shows banner when update available
- Dismissible (stored in localStorage)
- Expandable instructions panel

### 4. Environment Detection

The system automatically detects how YCode is deployed:

| Environment | Detection | Update Method |
|------------|-----------|---------------|
| **GitHub + Vercel** | `VERCEL_GIT_PROVIDER=github` | One-click GitHub sync |
| **Other Git + Vercel** | `VERCEL=1` without GitHub | Manual git pull |
| **Local** | No Vercel vars | Manual git pull |

### 5. Version Comparison

Uses semantic versioning comparison:

```typescript
compareVersions("1.2.0", "1.0.0") // Returns 1 (newer)
compareVersions("1.0.0", "1.2.0") // Returns -1 (older)
compareVersions("1.0.0", "1.0.0") // Returns 0 (equal)
```

## For End Users

### Updating Your YCode Installation

#### Method 1: GitHub UI (Easiest)

1. Wait for update notification in `/ycode`
2. Click **"Sync Update"** button
3. GitHub opens → Click **"Update branch"**
4. Vercel deploys automatically
5. Hard refresh your site (Cmd+Shift+R)

#### Method 2: Git Command Line

1. Open terminal in your project
2. Run:
   ```bash
   git fetch upstream
   git merge upstream/main
   git push origin main
   ```
3. Vercel deploys automatically

#### Method 3: Manual Check

Visit `/api/updates/check` on your deployed site to see current version and available updates.

## For Developers

### Creating a New Release

To trigger update notifications for users:

1. Update version in `package.json`:
   ```json
   {
     "version": "1.2.0"
   }
   ```

2. Commit and tag:
   ```bash
   git add package.json
   git commit -m "Version 1.2.0"
   git tag v1.2.0
   git push origin main --tags
   ```

3. Create GitHub Release:
   - Go to Releases → **Draft a new release**
   - Choose tag: `v1.2.0`
   - Title: `Version 1.2.0`
   - Description: What's new, fixes, breaking changes
   - Click **Publish release**

4. Users see notification immediately!

### Release Notes Format

Use markdown for rich formatting:

```markdown
## 🎉 What's New

- ✨ Feature: Auto-update system
- 🎨 UI: New dark theme
- ⚡ Performance: 50% faster page loads

## 🐛 Bug Fixes

- Fixed image upload on Safari
- Resolved draft save conflicts

## 📚 Documentation

- Added deployment guide
- Updated troubleshooting

## ⚠️ Breaking Changes

None! This is a drop-in update.
```

### Testing Updates Locally

```bash
# Test update check API
curl http://localhost:3000/api/updates/check | jq

# Mock having an old version
# Edit package.json → "version": "0.9.0"
npm run dev

# Visit http://localhost:3000/ycode
# Should see update banner
```

### Customizing Update Behavior

Edit `app/api/updates/check/route.ts`:

```typescript
// Change upstream repository
const UPSTREAM_REPO = 'your-org/your-repo';

// Adjust check interval (in UpdateNotification.tsx)
const interval = setInterval(checkForUpdates, 3600000); // 1 hour

// Modify version comparison logic
function compareVersions(a: string, b: string): number {
  // Your custom logic here
}
```

## Configuration

### Environment Variables Used

The update system automatically reads these Vercel variables:

- `VERCEL` - Detects if running on Vercel
- `VERCEL_GIT_PROVIDER` - Git provider (github/gitlab/bitbucket)
- `VERCEL_GIT_REPO_OWNER` - Your GitHub username/org
- `VERCEL_GIT_REPO_SLUG` - Your repository name

**No setup required!** These are set automatically by Vercel.

### Disabling Update Checks

To disable for a specific installation, edit `components/UpdateNotification.tsx`:

```typescript
// Add at top of component:
if (process.env.NEXT_PUBLIC_DISABLE_UPDATE_CHECK === 'true') {
  return null;
}
```

Then set in Vercel:
```
NEXT_PUBLIC_DISABLE_UPDATE_CHECK=true
```

## User Privacy

**What data is collected:**
- None! All checks happen client-side

**What data is sent:**
- GitHub API requests (public data only)
- No user data, no analytics, no tracking

## Troubleshooting

### "Unable to check for updates"

**Causes:**
- GitHub API rate limit reached
- No internet connection
- GitHub is down

**Solution:** Wait 1 hour and it will retry automatically

### Update banner won't dismiss

**Cause:** LocalStorage not working

**Solution:**
- Check browser privacy settings
- Try different browser
- Clear cache and cookies

### "Sync Update" button doesn't work

**Causes:**
- Not deployed via GitHub + Vercel
- Wrong repository detection

**Solution:**
- Use "How to Update" → manual steps
- Check Vercel environment variables

### Update installed but version unchanged

**Causes:**
- Didn't update `package.json` version
- Browser cache
- Vercel serving old deployment

**Solution:**
- Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
- Check Vercel deployment logs
- Verify `package.json` version in repo

## Future Enhancements

Potential improvements:

- [ ] Auto-apply updates with one click (requires GitHub token)
- [ ] Changelog viewer in-app
- [ ] Rollback to previous version
- [ ] Beta channel for early access
- [ ] Email notifications for critical updates
- [ ] Automatic daily checks setting

## Related Files

- `components/UpdateNotification.tsx` - UI component
- `app/api/updates/check/route.ts` - Update check API
- `package.json` - Current version source
- `app/ycode/page.tsx` - Where banner is displayed

## Support

Having issues with updates?

1. Check [GitHub Releases](https://github.com/liamwalder/test/releases)
2. View [Deployment Guide](./DEPLOYMENT.md)
3. Open an [issue](https://github.com/liamwalder/test/issues)

---

**Keep your YCode fresh! 🚀**

