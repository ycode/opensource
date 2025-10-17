# YCode - Build Websites Visually

**Create and edit your website by clicking and dragging** - no coding required! YCode is a visual website builder that you host yourself. It's like having your own Wix or Squarespace, but you own everything.

---

## 🎯 What You'll Get

- **Visual Editor** - Click, drag, and drop to build pages (like PowerPoint, but for websites)
- **No Code Required** - Edit text, images, and layouts with simple clicks
- **Your Own Website** - Publish pages instantly, they go live immediately
- **You Own Everything** - All your data stays with you, no monthly fees to us
- **Easy Updates** - One-click updates when we release new features

---

## 🚀 Let's Get You Set Up!

This will take about **10-15 minutes**. Don't worry, we'll walk through everything step-by-step.

### What You'll Need

Before we start, open these in new tabs (they're all free):

1. **GitHub account** - [Sign up here](https://github.com/signup) (if you don't have one)
2. **Vercel account** - [Sign up here](https://vercel.com/signup) (click "Continue with GitHub")
3. **Supabase account** - [Sign up here](https://supabase.com) (click "Start your project")

All of these are free forever for small projects!

---

## 📝 Step 1: Copy This Project to Your GitHub

**What we're doing:** Making your own copy of YCode that you can customize and deploy.

1. Make sure you're logged into GitHub
2. Look at the **top right** of this page
3. Click the **"Fork"** button (it looks like a fork icon 🍴)
4. Click **"Create fork"**

**Done!** You now have your own copy at `github.com/YOUR-USERNAME/test`

> **Why do this?** This lets you update YCode easily in the future with just one click!

---

## 🚀 Step 2: Put Your Website Online with Vercel

**What we're doing:** Vercel will host your website for free and make it accessible on the internet.

### Part A: Connect Vercel to Your GitHub

1. Go to [vercel.com/new](https://vercel.com/new)
2. If this is your first time:
   - Click **"Continue with GitHub"**
   - Click **"Authorize Vercel"** (this lets Vercel see your projects)

### Part B: Deploy Your Fork

3. You'll see a list of your GitHub repositories
4. Find **"test"** in the list (the one you just forked)
5. Click **"Import"** next to it
6. Click the big blue **"Deploy"** button
7. Wait 1-2 minutes while Vercel builds your site ☕

**Done!** Your site is now live! Vercel will show you a URL like `your-site.vercel.app`

---

## 💾 Step 3: Set Up Your Database with Supabase

**What we're doing:** Creating a place to store your website's pages and images.

### Part A: Create a New Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **"New project"**
3. Fill in:
   - **Name:** `ycode` (or anything you like)
   - **Database Password:** Make up a strong password and **save it somewhere safe**
   - **Region:** Choose the one closest to you
4. Click **"Create new project"**
5. Wait 1-2 minutes while Supabase sets up your database ☕

### Part B: Get Your Connection Details

6. When ready, click **"Settings"** (gear icon in the sidebar)
7. Click **"API"**
8. **Keep this tab open** - you'll need to copy some things from here!

You'll see:
- **Project URL** - Something like `https://abcdefgh.supabase.co`
- **anon public** key - A long code starting with `eyJ...`
- **service_role** key - Another long code (click "Reveal" to see it)

> **Don't worry if this looks confusing** - you just need to copy/paste these in the next step!

---

## 🔗 Step 4: Connect Vercel to Supabase

**What we're doing:** Telling your website how to find your database.

### Part A: Add Your Supabase Details to Vercel

1. Go back to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click on your **"test"** project
3. Click **"Settings"** (top menu)
4. Click **"Environment Variables"** (left sidebar)

### Part B: Add the Connection Details (Do This 3 Times)

**Variable 1: Project URL**
1. In **"Key"**, type: `SUPABASE_URL`
2. In **"Value"**, go to your Supabase tab and copy your **Project URL**
3. Make sure **all three checkboxes** are checked (Production, Preview, Development)
4. Click **"Save"**

**Variable 2: Public Key**
1. Click **"Add Another"**
2. In **"Key"**, type: `SUPABASE_ANON_KEY`
3. In **"Value"**, copy the **anon public** key from Supabase
4. Make sure **all three checkboxes** are checked
5. Click **"Save"**

**Variable 3: Secret Key**
1. Click **"Add Another"**
2. In **"Key"**, type: `SUPABASE_SERVICE_ROLE_KEY`
3. In **"Value"**, click **"Reveal"** next to service_role in Supabase, then copy it
4. Make sure **all three checkboxes** are checked
5. Click **"Save"**

### Part C: Restart Your Site

6. Click **"Deployments"** (top menu)
7. Click the **"..."** menu on your latest deployment
8. Click **"Redeploy"**
9. Click **"Redeploy"** again to confirm
10. Wait 1 minute ☕

**Done!** Your website can now talk to your database!

---

## 🎨 Step 5: Finish Setup & Start Building!

**Almost there!** Now we just need to set up your database tables and create your login.

### Part A: Visit Your Website

1. Go to your Vercel dashboard
2. Click **"Visit"** (or go to your `your-site.vercel.app` URL)
3. You should see a welcome screen!

### Part B: Run the Setup Wizard

4. You'll see instructions about environment variables - **you already did this!** Click **"Verify Configuration"**
5. Click **"Next Step"** when it confirms your connection

### Part C: Set Up Your Database Tables

6. You'll see some SQL code in a box
7. **Copy all of it** (click the copy button)
8. Go back to **Supabase** in another tab
9. Click **"SQL Editor"** (in the left sidebar)
10. Click **"New query"**
11. **Paste** the SQL code you copied
12. Click the big **"Run"** button (or press Cmd+Enter / Ctrl+Enter)

You should see "Success. No rows returned"

13. Go back to your YCode website
14. Click **"I've run the migrations"**

### Part D: Create Your Login

15. Visit `your-site.vercel.app/ycode`
16. You'll see a **"Create Your Account"** section
17. Enter your email and choose a password
18. Click **"Create Account & Go to Builder →"**

---

## 🎉 You're Done! Start Building!

**Congratulations!** You now have your own visual website builder!

### What You Can Do Now:

**Build Your First Page:**
1. You're now in the builder (it should say `/ycode` in the URL)
2. On the left, you'll see "Home" - this is your first page
3. Click the **"+"** button to add elements:
   - **Container** - Like a box to put things in
   - **Heading** - Big text for titles
   - **Paragraph** - Regular text
   - **Image** - Pictures (click "Assets" tab first to upload)

**Edit Elements:**
1. Click any element in the middle preview area
2. On the right, you'll see a box where you can edit the styling
3. Try typing: `bg-blue-500 p-8 rounded-lg text-white`
4. Click **"Apply"** - your element now has a blue background!

**Make It Live:**
1. When you're happy with your page, click **"Publish"** (top right)
2. Visit your site: `your-site.vercel.app/home`
3. Your page is live! 🎉

---

## 📚 Quick Tips

### Working with Styling

The box on the right uses **Tailwind classes** - think of them as shortcuts for styling:

- `bg-blue-500` - Blue background
- `text-white` - White text
- `p-4` - Padding (spacing inside)
- `m-4` - Margin (spacing outside)
- `rounded` - Rounded corners
- `flex gap-4` - Put things side by side

[See all Tailwind classes](https://tailwindcss.com/docs)

### Keyboard Shortcuts

- `Ctrl+C` (or `Cmd+C` on Mac) - Copy an element
- `Ctrl+V` (or `Cmd+V` on Mac) - Paste an element
- `Ctrl+Z` (or `Cmd+Z` on Mac) - Undo
- `Delete` or `Backspace` - Delete selected element

### Adding Images

1. Click **"Assets"** tab (top left, next to "Pages")
2. Click **"Upload Image"**
3. Choose a file from your computer
4. Click the image to copy its name
5. Go back to **"Pages"** tab
6. Add an **"Image"** element
7. Select it, and the right panel will let you choose the image

### Creating New Pages

1. Click the **"+"** next to "Pages" (top left)
2. Give it a name (like "About")
3. Give it a URL slug (like "about")
4. Click **"Create Page"**
5. Build your page, then click **"Publish"**
6. Visit: `your-site.vercel.app/about`

---

## 🔄 Updating YCode (When We Release New Features)

We'll regularly add new features and improvements. Here's how to get them:

1. Go to your GitHub fork: `github.com/YOUR-USERNAME/test`
2. You'll see a message: **"This branch is X commits behind liamwalder:test"**
3. Click the **"Sync fork"** button
4. Click **"Update branch"**
5. **Done!** Vercel will automatically redeploy with the updates

Your pages and settings will stay safe - only YCode itself gets updated!

---

## ❓ Something Not Working?

### "My website shows an error"

1. **Check Vercel** - Go to your Vercel project → Deployments → Click latest → Look for errors
2. **Check environment variables** - Make sure all 3 variables are set correctly (Step 4)
3. **Redeploy** - Sometimes a fresh deploy fixes issues

### "I can't log in"

1. Go to Supabase → Authentication → Providers → Email
2. Turn **OFF** "Enable email confirmations"
3. Delete your account and create a new one

### "My images won't upload"

1. Make sure you ran the SQL code from the setup wizard (Step 5, Part C)
2. Go to Supabase → Storage → Check if "assets" bucket exists
3. If not, run the SQL code again

### "I forgot my password"

Currently, you'll need to:
1. Go to Supabase → Authentication → Users
2. Delete your user
3. Go to your website `/ycode` and create a new account

(Password reset coming soon!)

### Still stuck?

- [Ask a question in Discussions](https://github.com/liamwalder/test/discussions)
- [Report a bug](https://github.com/liamwalder/test/issues)

---

## 💡 What's Next?

Once you're comfortable with the basics:

- **Custom domain** - Connect your own domain name (like `mywebsite.com`) in Vercel settings
- **More pages** - Build About, Contact, Blog pages
- **Customize styles** - Experiment with different Tailwind classes
- **Explore features** - Try the preview modes (mobile/tablet/desktop views)

---

## 🙏 Made Possible By

- [Next.js](https://nextjs.org) - The framework powering YCode
- [Supabase](https://supabase.com) - Your database and file storage
- [Vercel](https://vercel.com) - Hosting your website
- [Tailwind CSS](https://tailwindcss.com) - The styling system

---

<div align="center">
  <br />
  <sub>Build beautiful websites, visually. No code required.</sub>
  <br />
  <br />
  <sub>Questions? <a href="https://github.com/liamwalder/test/discussions">Ask in Discussions</a></sub>
</div>
