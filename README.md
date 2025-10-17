# YCode - Self-Hosted Visual Website Builder

<div align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js" alt="Next.js 15" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-green?style=for-the-badge&logo=supabase" alt="Supabase" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="MIT License" />
</div>

<br />

**YCode** is a self-hosted visual website builder that lets you create and edit websites through an intuitive drag-and-drop interface. Build pages visually in the browser, and they're instantly live on your site.

## ✨ Features

- 🎨 **Visual Builder** - Figma-style drag-and-drop interface
- 🏗️ **Layer-Based Editing** - Nested components with full Tailwind support
- 📝 **Draft & Publish** - Work on drafts, publish when ready
- ⚡ **Real-Time Preview** - See changes instantly in the canvas
- 🎯 **Direct Tailwind Editing** - Edit classes directly for full control
- 🖼️ **Asset Management** - Upload and manage images via Supabase Storage
- 🔒 **Supabase Auth** - Secure authentication for builder access
- 🚀 **Vercel CDN** - Automatic caching with on-demand revalidation
- 📦 **Self-Hosted** - Your data, your infrastructure, your control

## 🚀 Quick Deploy

Deploy YCode to Vercel in one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fliamwalder%2Ftest)

After deployment:
1. Visit your deployed URL
2. Complete the welcome wizard (connect Supabase)
3. Create your admin account
4. Start building!

## 📋 Prerequisites

Before you begin, you'll need:

- **Supabase Account** - [Sign up for free](https://supabase.com)
- **Supabase Project** - Create a new project in your Supabase dashboard
- **Node.js 18+** - For local development

## 🛠️ Local Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/liamwalder/test.git
cd test
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Development Server

```bash
npm run dev
```

Visit http://localhost:3000 to see your app.

### 4. Complete Setup Wizard

On first visit, you'll see the setup wizard:

1. **Welcome** - Introduction to YCode
2. **Connect Supabase** - Enter your Supabase credentials
3. **Run Migrations** - Copy SQL to Supabase SQL Editor and run
4. **Create Admin Account** - Set up your admin login

## 📦 Supabase Setup

### 1. Create Supabase Project

Go to https://supabase.com/dashboard and create a new project.

### 2. Get Your Credentials

In your Supabase project:
- Go to **Settings** → **API**
- Copy:
  - **Project URL** (e.g., `https://xxxxx.supabase.co`)
  - **anon/public key** (starts with `eyJ...`)
  - **service_role key** (starts with `eyJ...`, secret)

### 3. Disable Email Confirmation (Recommended)

For easier setup:
1. Go to **Authentication** → **Providers** → **Email**
2. Uncheck **"Enable email confirmations"**
3. Click **Save**

This prevents the "Email not confirmed" error and is perfect for self-hosted single-admin setups.

### 4. Run Migrations

The setup wizard will provide SQL to run in Supabase:
1. Copy the SQL from the wizard
2. Go to **SQL Editor** in Supabase
3. Paste and click **Run**

This creates the required tables and storage buckets.

## 🎨 Using YCode

### Building Pages

1. **Access Builder** - Visit `/ycode` and log in
2. **Create Page** - Click "+" in the sidebar
3. **Add Layers** - Use the "+" button to add containers, text, headings, images
4. **Edit Classes** - Select a layer and edit Tailwind classes in the right panel
5. **Preview** - See changes in real-time in the center canvas
6. **Publish** - Click "Publish" to make your page live

### Layer Types

- **Container** - `<div>` for layout (flex, grid, etc.)
- **Heading** - `<h1>` for titles
- **Paragraph** - `<p>` for text content
- **Image** - `<img>` for pictures (use Assets tab to upload)

### Keyboard Shortcuts

- `Cmd/Ctrl + C` - Copy selected layer
- `Cmd/Ctrl + V` - Paste copied layer
- `Cmd/Ctrl + Z` - Undo
- `Cmd/Ctrl + Shift + Z` - Redo
- `Delete` or `Backspace` - Delete selected layer

## 🚀 Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Click "Import Project"
4. Select your repository
5. Click "Deploy"

### Post-Deployment Setup

After deploying to Vercel, you need to configure environment variables:

#### 1. Set Environment Variables in Vercel

Go to your Vercel Dashboard → Project → Settings → Environment Variables and add:

| Variable Name | Value | Where to Find |
|--------------|--------|---------------|
| `SUPABASE_URL` | `https://xxxxx.supabase.co` | Supabase Dashboard → Settings → API |
| `SUPABASE_ANON_KEY` | `eyJ...` (long token) | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (secret token) | Supabase Dashboard → Settings → API |

**Important:** 
- Make sure to add these to **Production**, **Preview**, and **Development** environments
- Click "Save" after adding each variable

#### 2. Redeploy

After adding environment variables:
1. Go to Deployments tab
2. Click "..." on the latest deployment
3. Click "Redeploy"

Or trigger a new deployment by pushing to your repository.

#### 3. Run Migrations & Create Account

1. Visit your deployed URL
2. Go to `/welcome` 
3. The setup wizard will detect your Supabase connection
4. Run migrations (copy SQL to Supabase SQL Editor)
5. Create your admin account at `/ycode`

**Note:** On Vercel, credentials are stored as environment variables (not in a file). This is more secure and works with Vercel's read-only filesystem.

## 📁 Project Structure

```
ycode/
├── app/                      # Next.js App Router
│   ├── [slug]/              # Dynamic public pages
│   ├── api/                 # API routes
│   ├── ycode/               # Visual builder interface
│   │   └── components/      # Builder UI components
│   └── welcome/             # Setup wizard
├── components/              # Shared React components
│   ├── layers/              # Layer renderers
│   ├── AssetLibrary.tsx     # Asset management
│   └── AuthProvider.tsx     # Auth initialization
├── lib/                     # Utilities
│   ├── repositories/        # Database access layer
│   ├── services/            # Business logic
│   └── supabase-server.ts   # Supabase server client
├── stores/                  # Zustand state management
│   ├── useAuthStore.ts      # Authentication
│   ├── useEditorStore.ts    # Editor state
│   └── usePagesStore.ts     # Pages & layers
├── types/                   # TypeScript definitions
├── database/                # Supabase SQL migrations
│   └── supabase/
└── .credentials.json        # Supabase credentials (gitignored)
```

## 🔧 Tech Stack

- **Framework**: Next.js 15 (App Router, React Server Components)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage (for images)
- **State Management**: Zustand
- **Deployment**: Vercel
- **Caching**: Vercel CDN with ISR

## 🎯 Architecture

### Self-Hosted Model

Each YCode installation is **completely independent**:
- Deploy to your own Vercel account
- Connect your own Supabase instance
- All data stored in **your** database
- No vendor lock-in, no shared backend

### Authentication

- Only `/ycode` requires authentication
- All public pages (`/`, `/about`, etc.) are open to everyone
- Single admin user model (Phase 1)
- Future: Teams, roles, collaboration

### Data Flow

```
Browser → Next.js API Routes → Supabase (PostgreSQL)
                              ↓
                         Your Database
```

### Page Rendering

- **Builder** - Edit draft versions, autosave every 2 seconds
- **Publish** - Copy draft to published version
- **Public Pages** - Fetch published version, cached by Vercel CDN
- **Cache Invalidation** - On publish, cache is automatically purged

## 🔐 Security

- **Credentials** - Stored in `.credentials.json` (gitignored)
- **Authentication** - Supabase Auth with JWT tokens
- **Session Storage** - HTTP-only cookies
- **Database Access** - Server-side only via service role
- **RLS Policies** - Row-Level Security on Supabase tables

## 📝 Environment Variables

### Local Development
- Credentials stored in `.credentials.json` (file-based)
- Created automatically through the welcome wizard
- Gitignored, never committed

### Production (Vercel)
**Required environment variables:**

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Your Supabase project URL | `https://xxxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Public anon/public key | `eyJhbGc...` (JWT token) |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret service role key | `eyJhbGc...` (JWT token) |

**Why environment variables on Vercel?**
- Vercel has a read-only filesystem (can't write files)
- Environment variables are more secure
- Standard practice for serverless deployments

**How to set:**
1. Vercel Dashboard → Your Project → Settings
2. Environment Variables
3. Add each variable for all environments (Production, Preview, Development)
4. Redeploy

## 🐛 Troubleshooting

### "EROFS: read-only file system" error on Vercel

**Error:** `EROFS: read-only file system, open '/var/task/.credentials.json'`

**Cause:** Vercel's serverless environment has a read-only filesystem. You can't write files in production.

**Solution:** Use environment variables instead:

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Add these three variables:
   - `SUPABASE_URL` = Your Supabase project URL
   - `SUPABASE_ANON_KEY` = Your anon/public key (starts with `eyJ`)
   - `SUPABASE_SERVICE_ROLE_KEY` = Your service role key (starts with `eyJ`)
3. Make sure to add them to **all environments** (Production, Preview, Development)
4. Go to **Deployments** → Click "..." on latest → **Redeploy**
5. Visit your site - it should now work!

### "Email not confirmed" error

**Solution:** Disable email confirmation in Supabase:
1. Authentication → Providers → Email
2. Uncheck "Enable email confirmations"
3. Delete existing user and recreate

### "Failed to get Supabase config"

**Solution:** Check browser console for detailed error:
1. Open DevTools (F12)
2. Check Console tab
3. Run `node check-credentials.js` to verify credentials file

### Pages load slowly

**Solution:** This is fixed! Pages now query database directly instead of HTTP calls.

### "Supabase not configured"

**Solution:** Complete the setup wizard at `/welcome`

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org)
- Database by [Supabase](https://supabase.com)
- Deployed on [Vercel](https://vercel.com)
- Styled with [Tailwind CSS](https://tailwindcss.com)
- Font: [Inter](https://rsms.me/inter/)

## 🚀 Roadmap

- [x] Visual page builder
- [x] Layer-based editing
- [x] Tailwind class editing
- [x] Asset management
- [x] Authentication
- [x] Draft/Publish workflow
- [ ] Component library
- [ ] Responsive breakpoints UI
- [ ] Multi-user support
- [ ] Team collaboration
- [ ] Role-based permissions
- [ ] Custom domains
- [ ] SEO metadata editor
- [ ] Form builder
- [ ] E-commerce components

## 💬 Support

For help and questions:
- 📖 Check the documentation above
- 🐛 [Open an issue](https://github.com/liamwalder/test/issues)
- 💬 [Join discussions](https://github.com/liamwalder/test/discussions)

---

<div align="center">
  Made with ❤️ by the YCode team
  <br />
  <sub>Build beautiful websites, visually.</sub>
</div>
