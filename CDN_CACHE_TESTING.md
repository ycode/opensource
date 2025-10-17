# Vercel CDN Cache Testing Guide

## ✅ What's Configured

### Public Pages (Cached by CDN):
- **Route**: `/:slug` (e.g., `/home`, `/about`)
- **Strategy**: Static Site Generation (SSG) with ISR
- **Revalidate**: 1 hour (3600 seconds)
- **CDN Cache**: 1 hour (`s-maxage=3600`)
- **Stale While Revalidate**: 24 hours
- **Cache Tags**: `page-{slug}` for targeted invalidation

### API Routes (NOT Cached):
- **Routes**: `/api/*`, `/ycode/*`
- **Cache Control**: `no-store, no-cache, must-revalidate`
- **CDN**: Explicitly bypassed with `CDN-Cache-Control: no-store`

---

## 🧪 Testing CDN Cache

### Test 1: Verify Public Page Caching

After deploying to Vercel, test a published page:

```bash
# First request - Should MISS (caches it)
curl -I https://opensource-mu.vercel.app/about

# Expected headers:
# x-vercel-cache: MISS (or HIT if prerendered)
# cache-control: s-maxage=3600, stale-while-revalidate=86400, must-revalidate
# age: 0 (or small number)
```

```bash
# Second request - Should HIT (served from CDN)
curl -I https://opensource-mu.vercel.app/about

# Expected headers:
# x-vercel-cache: HIT
# age: <number> (seconds since cached)
```

### Test 2: Verify API Routes Are NOT Cached

```bash
# API routes should ALWAYS be MISS
curl -I https://opensource-mu.vercel.app/api/pages

# Expected headers:
# x-vercel-cache: MISS (every time)
# cache-control: no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0
# cdn-cache-control: no-store
```

### Test 3: Cache Invalidation on Publish

1. **Visit a published page** and note the `age` header:
   ```bash
   curl -I https://opensource-mu.vercel.app/about
   # Note the "age" value
   ```

2. **Edit and publish the page** in the YCode builder:
   - Make a change to the page
   - Click "Publish"
   - Wait 5 seconds

3. **Check the page again**:
   ```bash
   curl -I https://opensource-mu.vercel.app/about
   # Expected: age: 0 (cache was cleared!)
   # Expected: x-vercel-cache: MISS (cache was invalidated)
   ```

4. **Check again immediately**:
   ```bash
   curl -I https://opensource-mu.vercel.app/about
   # Expected: x-vercel-cache: HIT (re-cached after publish)
   ```

---

## 📊 Understanding Cache Headers

### `x-vercel-cache` Values:
- **MISS**: Page was not in cache, fetched fresh from origin
- **HIT**: Page was served from CDN cache (fast!)
- **STALE**: Serving stale cache while revalidating in background

### `cache-control` Directives:
- **s-maxage=3600**: CDN caches for 1 hour
- **stale-while-revalidate=86400**: Serve stale for 24h while updating
- **must-revalidate**: Browser must check with CDN before using cache

### `age` Header:
- Shows how many seconds the cached response has been in cache
- `age: 0` means freshly cached
- `age: 1800` means cached 30 minutes ago

---

## 🎯 Expected Behavior

### First Visit (No Cache):
1. User visits `/about`
2. Next.js generates page from database
3. CDN caches the response
4. Response header: `x-vercel-cache: MISS`
5. Subsequent visitors get `HIT` for 1 hour

### After Publish:
1. User clicks "Publish" in builder
2. Server calls `revalidateTag('page-about')`
3. Next.js clears cached page
4. CDN cache is purged
5. Next visitor gets `MISS` (fresh)
6. Page is re-cached for 1 hour

### ISR Revalidation (Fallback):
- If cache isn't manually purged, it auto-revalidates after 1 hour
- Users may see stale content for up to 24 hours (stale-while-revalidate)
- This is a safety net in case manual invalidation fails

---

## 🐛 Troubleshooting

### Problem: Always seeing `MISS` on public pages

**Possible causes:**
1. Page is actually dynamic (check build output)
2. Cache headers not applied (check `next.config.ts`)
3. Something forcing dynamic rendering

**Check build output:**
```bash
npm run build | grep "\[slug\]"

# Should show:
# ● /[slug]   ...   Revalidate: 1h
```

---

### Problem: Always seeing `private, no-cache` headers

**This means the route is dynamic, not static.**

**Fix:**
1. Ensure `export const dynamic = 'force-static'` in page
2. Ensure `export const revalidate = 3600` in page
3. Check for dynamic functions (cookies, headers, searchParams)

---

### Problem: Cache not invalidating on publish

**Check server logs:**
```
✅ Cache invalidated for page: /about (tag: page-about)
```

**If not working:**
1. Check `invalidatePage()` is called in publish endpoint
2. Check `revalidateTag()` and `revalidatePath()` are imported
3. Deploy to Vercel (revalidation only works in production)

---

## 📝 Build Output Example

After running `npm run build`, you should see:

```
Route (app)                              Size  First Load JS  Revalidate  Expire
┌ ● /[slug]                              1.2 kB         103 kB          1h      1y
├   ├ /about                                                            1h      1y
└   └ /home                                                             1h      1y
```

- `●` = Static Site Generation (SSG)
- `Revalidate: 1h` = ISR with 1 hour revalidation
- `Expire: 1y` = Long-term CDN cache with revalidation

---

## ✅ Success Checklist

- [ ] Public pages show `x-vercel-cache: HIT` on second request
- [ ] API routes always show `x-vercel-cache: MISS`
- [ ] Publishing a page resets `age` to 0
- [ ] Build output shows `● /[slug]` with `Revalidate: 1h`
- [ ] Cache headers include `s-maxage=3600`

---

## 🚀 Next Steps

Once caching is verified:
1. Monitor cache hit rates in Vercel Analytics
2. Adjust `revalidate` time if needed (currently 1 hour)
3. Consider adding homepage caching (currently dynamic)


