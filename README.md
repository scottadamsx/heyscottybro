# heyScottyBro

Personal portfolio + all-in-one admin site built with React + Vite + Supabase.

## Stack
- **Frontend**: React 18 + React Router + Vite
- **Database / Auth**: Supabase (magic link auth, PostgreSQL)
- **Hosting**: Hostinger (static files from `dist/`)

## Setup

### 1. Supabase
1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run `SUPABASE_SETUP.sql` in your Supabase SQL editor to create all tables
3. In Auth > URL Configuration, add your site URL and set the redirect URL to `https://yourdomain.com/admin/dashboard`

### 2. Environment Variables
Create a `.env` file in the root (see `.env.example`):
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### 3. Development
```bash
npm install
npm run dev
```

### 4. Build for Hostinger
```bash
npm run build
```
Upload the `dist/` folder contents to Hostinger via FTP or their file manager.

Make sure to configure Hostinger to serve `index.html` for all routes (SPA routing). In the `.htaccess`:
```apache
Options -MultiViews
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^ index.html [QSA,L]
```

## Structure
- `/` — Landing page
- `/never86` — NEVER86 project page
- `/sjhc` — St. John's Hike Club page
- `/games` — Games hub
- `/games/minecraft-trivia` — Minecraft Trivia (fullscreen iframe)
- `/games/monopoly-banker` — Monopoly Banker (fullscreen iframe)
- `/games/tictactoe` — Tic-Tac-Toe (React)
- `/admin/login` — Magic link login
- `/admin/dashboard` — Protected planner dashboard
- `/admin/reminders` — Tasks & reminders
- `/admin/calendar` — Calendar with events
- `/admin/journal` — Personal journal
- `/admin/budget` — Budget tracker
