# Rose Trading Website

A static website built with Astro matching the design of your "Beginners Guide to Trading" Canva presentation.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:4321` to see your site.

### 3. Build for Production

```bash
npm run build
```

This creates a `dist` folder with your static site.

## 📦 Deploy to Netlify

### Option A: Deploy via Netlify UI (Easiest)

1. Create a free account at [netlify.com](https://netlify.com)
2. Click "Add new site" → "Deploy manually"
3. Drag and drop your `dist` folder
4. Your site is live! Netlify will give you a URL like `your-site.netlify.app`

### Option B: Deploy via GitHub (Recommended)

1. Push your code to GitHub:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/rose-trading.git
git push -u origin main
```

2. In Netlify:
   - Click "Add new site" → "Import an existing project"
   - Connect to GitHub
   - Select your repository
   - Build settings:
     - Build command: `npm run build`
     - Publish directory: `dist`
   - Click "Deploy"

## 🌐 Connect Your Domain (rose.trading)

Once your site is deployed on Netlify:

### Step 1: Get Your Netlify DNS Settings

1. In Netlify, go to: Site Settings → Domain Management → Domains
2. Click "Add custom domain"
3. Enter `rose.trading`
4. Netlify will show you DNS configuration options

### Step 2: Configure Namecheap DNS

1. Log into [Namecheap](https://namecheap.com)
2. Go to Domain List → find `rose.trading` → click "Manage"
3. Scroll to "Advanced DNS"

**Add these records:**

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A Record | @ | 75.2.60.5 | Automatic |
| CNAME Record | www | your-site.netlify.app | Automatic |

**Note:** Replace `your-site.netlify.app` with your actual Netlify URL.

### Alternative: Use Netlify Nameservers (Recommended)

Instead of the above, you can use Netlify's nameservers for better performance:

1. In Netlify → Domain Settings → click "Set up Netlify DNS"
2. Netlify will give you nameservers like:
   - dns1.p01.nsone.net
   - dns2.p01.nsone.net
   - dns3.p01.nsone.net
   - dns4.p01.nsone.net

3. In Namecheap:
   - Go to Domain List → rose.trading → Manage
   - Find "Nameservers" section
   - Select "Custom DNS"
   - Enter all 4 Netlify nameservers

### Step 3: Wait for DNS Propagation

- DNS changes can take 1-48 hours to propagate globally
- Usually happens within a few hours
- Check status at: https://dnschecker.org

## 📁 Project Structure

```
rose-trading/
├── src/
│   ├── components/       # Reusable components
│   │   ├── Hero.astro
│   │   ├── ResourceCard.astro
│   │   └── StepCard.astro
│   ├── layouts/
│   │   └── Layout.astro  # Main layout wrapper
│   ├── pages/
│   │   └── index.astro   # Homepage
│   └── styles/
│       └── global.css    # Global styles
├── public/               # Static assets (images, etc.)
├── astro.config.mjs     # Astro configuration
└── package.json
```

## 🎨 Customization

### Colors

Edit `src/styles/global.css` to change the color scheme:

```css
:root {
  --bg-primary: #0f0f1a;      /* Main background */
  --bg-secondary: #1a1a2e;    /* Section backgrounds */
  --bg-card: #252540;         /* Card backgrounds */
  --text-primary: #ffffff;    /* Main text */
  --text-secondary: #b8b8d1;  /* Secondary text */
  --accent-primary: #6c63ff;  /* Primary accent */
  --accent-secondary: #8b84ff; /* Secondary accent */
}
```

### Adding New Pages

Create new `.astro` files in `src/pages/`:

```astro
---
import Layout from '../layouts/Layout.astro';
---

<Layout title="New Page">
  <div class="container section">
    <h1>New Page</h1>
    <p>Your content here</p>
  </div>
</Layout>
```

### Adding Images

1. Place images in the `public/` folder
2. Reference them in your pages:

```html
<img src="/logo.png" alt="Logo">
```

## 🔧 Development Commands

| Command | Action |
|---------|--------|
| `npm install` | Install dependencies |
| `npm run dev` | Start dev server at `localhost:4321` |
| `npm run build` | Build production site to `dist/` |
| `npm run preview` | Preview built site locally |

## 📱 Responsive Design

The site is fully responsive and looks great on:
- Desktop (1200px+)
- Tablet (768px - 1199px)
- Mobile (< 768px)

## 🆘 Troubleshooting

**Site not updating after DNS changes?**
- Clear your browser cache
- Try incognito mode
- Wait 24 hours for full propagation

**Build failing?**
- Make sure Node.js is installed: `node --version`
- Delete `node_modules` and run `npm install` again

**Links not working?**
- Check that all external links start with `https://`
- Verify URLs are correct in `src/pages/index.astro`

## 📚 Resources

- [Astro Documentation](https://docs.astro.build)
- [Netlify Documentation](https://docs.netlify.com)
- [Namecheap DNS Guide](https://www.namecheap.com/support/knowledgebase/article.aspx/767/10/how-to-change-dns-for-a-domain/)

---

Built with ❤️ using Astro
