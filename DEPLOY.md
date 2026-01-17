# 🚀 Deployment Guide: rose.trading

## Step-by-Step Instructions

### 1️⃣ Install & Test Locally (5 minutes)

```bash
# Navigate to the project
cd rose-trading

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:4321` - you should see your site!

Press `Ctrl+C` to stop the server when you're done testing.

---

### 2️⃣ Build for Production (1 minute)

```bash
npm run build
```

This creates a `dist/` folder with your optimized static site.

---

### 3️⃣ Deploy to Netlify (5 minutes)

#### Option A: Drag & Drop (Fastest)

1. Go to [app.netlify.com](https://app.netlify.com)
2. Sign up/login (free)
3. Click "Add new site" → "Deploy manually"
4. Drag the entire `dist/` folder onto the page
5. Done! You'll get a URL like `random-name-123.netlify.app`

#### Option B: GitHub (Recommended for updates)

1. Create a GitHub repository
2. Push your code:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/rose-trading.git
git push -u origin main
```

3. In Netlify:
   - "Add new site" → "Import from Git"
   - Connect GitHub
   - Select your repo
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Click "Deploy site"

---

### 4️⃣ Connect rose.trading Domain (10 minutes)

Once deployed, Netlify gives you a site (e.g., `wonderful-site-123.netlify.app`)

**Choose ONE method below:**

---

#### METHOD 1: A Record + CNAME (Simpler)

**In Namecheap:**

1. Login to Namecheap
2. Dashboard → Domain List → rose.trading → "Manage"
3. Click "Advanced DNS" tab
4. Add these records:

```
Type: A Record
Host: @
Value: 75.2.60.5
TTL: Automatic

Type: CNAME Record  
Host: www
Value: YOUR-SITE.netlify.app (replace with your actual Netlify URL)
TTL: Automatic
```

5. Delete any existing A or CNAME records for @ and www

**In Netlify:**

1. Site Settings → Domain management
2. Click "Add custom domain"
3. Enter `rose.trading`
4. When prompted about DNS, select "I'll configure DNS myself"
5. Also add `www.rose.trading` as a domain alias

✅ **Wait 1-24 hours for DNS to propagate**

---

#### METHOD 2: Netlify Nameservers (Faster, Recommended)

**In Netlify:**

1. Site Settings → Domain management → "Add custom domain"
2. Enter `rose.trading`
3. Click "Set up Netlify DNS"
4. Netlify will show you 4 nameservers like:
   ```
   dns1.p01.nsone.net
   dns2.p01.nsone.net
   dns3.p01.nsone.net
   dns4.p01.nsone.net
   ```
5. Copy these!

**In Namecheap:**

1. Domain List → rose.trading → "Manage"
2. Find "Nameservers" section at the top
3. Change from "Namecheap BasicDNS" to "Custom DNS"
4. Paste all 4 Netlify nameservers
5. Click the checkmark ✓ to save

✅ **Wait 1-24 hours for DNS to propagate**

---

### 5️⃣ Enable HTTPS (Automatic)

Once DNS is working:

1. In Netlify → Domain settings
2. Netlify automatically provisions an SSL certificate
3. Your site will be `https://rose.trading` 🔒

---

## 🔍 Checking if DNS is Working

Visit these sites to check DNS propagation:

- https://dnschecker.org (enter rose.trading)
- https://www.whatsmydns.net

Green checkmarks = propagated ✅

---

## 🎯 Quick Reference

**Your Netlify Dashboard:** https://app.netlify.com  
**Check DNS:** https://dnschecker.org  
**Namecheap DNS Settings:** Domain List → rose.trading → Manage → Advanced DNS

---

## 💡 After Setup

To update your site later:

1. Make changes to files
2. Run `npm run build`
3. If using GitHub: just push changes → Netlify auto-deploys
4. If manual deploy: drag new `dist/` folder to Netlify

---

## ❓ Common Issues

**"Domain already claimed"**
→ Remove domain from any other Netlify site first

**Site not loading after 24 hours**
→ Check DNS settings in Namecheap
→ Make sure you deleted old records
→ Try Method 2 (Netlify Nameservers)

**SSL certificate pending**
→ Wait for DNS to fully propagate first
→ Can take up to 24 hours

**Build fails**
→ Check that Node.js version is 18+
→ Run `npm install` again
→ Check Netlify build logs

---

## 📞 Need Help?

- Astro Docs: https://docs.astro.build
- Netlify Docs: https://docs.netlify.com
- Namecheap Support: https://www.namecheap.com/support/

You've got this! 🚀
