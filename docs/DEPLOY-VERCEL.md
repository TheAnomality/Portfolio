# Deploy to Vercel

Vercel builds the site from GitHub and redeploys it every time you push. The free **Hobby** plan is enough for this portfolio.

**What goes live**

| Part | What it is | Where it ends up |
| --- | --- | --- |
| The portfolio | `npm run build` creates `dist/` | `https://your-site.vercel.app/` |
| Atom | copied into `public/atom/` | `/atom/` |
| AnimeWiki | copied into `public/animewiki/` | `/animewiki/` |
| Contact form | `api/contact.js` (a Vercel Function) | `/api/contact` |
| Server rules | `vercel.json`: redirects, caching, security headers | applied automatically |

---

## Step 0: put the code on `main`

The work is on the branch `claude/confident-meitner-ggcax9`. Vercel deploys the **`main`** branch as your live site, so merge the branch first:

1. Open https://github.com/TheAnomality/Portfolio
2. GitHub shows a yellow banner, **"claude/confident-meitner-ggcax9 had recent pushes"**. Click **Compare & pull request**.
3. Click **Create pull request**, then **Merge pull request**, then **Confirm merge**.

> Other branches still deploy: each one gets its own **preview** URL, so you can test before merging.

## Step 1 (optional): run it on your computer

You need [Node.js](https://nodejs.org) 22 or newer and [Git](https://git-scm.com).

```bash
git clone https://github.com/TheAnomality/Portfolio.git
```

```bash
cd Portfolio
```

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173. Edits to `src/content/site.ts` (your text, links and projects) show up instantly.

## Step 2: import the project into Vercel

1. Go to https://vercel.com/signup and choose **Continue with GitHub**.
2. In the dashboard click **Add New…**, then **Project**.
3. Find **TheAnomality/Portfolio** and click **Import**.
   - Not in the list? Click **Adjust GitHub App Permissions** and allow Vercel to access the repository.
4. On **Configure Project**, leave the detected settings as they are (they also live in `vercel.json`):
   - Framework Preset: **Vite**
   - Root Directory: `./`
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Optional: open **Environment Variables** and add the contact-form keys from Step 4 now. You can also add them later.
6. Click **Deploy**. About a minute later you get a live address like `https://portfolio-theanomality.vercel.app`.

Your share preview, canonical URL and sitemap use this Vercel address automatically. Once you add a custom domain (Step 5), they switch to it on the next deploy.

## Step 3: updating the site

| You want to… | Do this |
| --- | --- |
| Change text, links or projects | Edit `src/content/site.ts`, commit, push to `main` |
| Pull in a new version of Atom or AnimeWiki | `npm run sync:projects`, then commit and push |
| Re-render the showreel video | `npm run showreel:render`, then commit `public/media/showreel*` and push |
| Test a change before it goes live | Push to any other branch and open its preview URL from Vercel |

Every push to `main` redeploys production. Watch progress under **Deployments** in your Vercel project.

## Step 4: turn on the contact form (free, about 5 minutes)

The form sends email through [Resend](https://resend.com) (free tier: 3,000 emails a month).

1. Sign up at https://resend.com with the address that should **receive** the messages.
2. Go to **API Keys**, click **Create API Key** (permission: Sending access) and copy the key. It starts with `re_`.
3. In Vercel, open your project, then **Settings → Environment Variables**, and add:

   | Key | Value |
   | --- | --- |
   | `RESEND_API_KEY` | the `re_…` key |
   | `CONTACT_TO_EMAIL` | the email you signed up to Resend with |

4. Environment variables only apply to new deployments, so open **Deployments**, click **⋯** on the latest one, and choose **Redeploy**.
5. Send yourself a test message from your live site.

> **Sending from your own domain (optional).** Until you verify a domain, Resend sends from `onboarding@resend.dev` and only delivers to your own Resend account email. To send from something like `hello@yourdomain.com`: in Resend open **Domains → Add Domain**, add the DNS records it shows at your domain registrar, wait for "Verified", then add a third variable in Vercel, `CONTACT_FROM_EMAIL` = `TheAnomality <hello@yourdomain.com>`, and redeploy.

The form has spam protection built in: a hidden honeypot field, a same-site check and a one-message-per-minute limit.

## Step 5: use your own domain (optional)

1. Get a domain from any registrar (Namecheap, Cloudflare, GoDaddy, Hostinger, …), or buy one inside Vercel under **Settings → Domains → Buy**.
2. In your Vercel project open **Settings → Domains**, type the domain (e.g. `theanomality.com`) and click **Add**. Accept the suggestion to add `www` too; Vercel redirects one to the other.
3. Vercel shows the DNS records to create at your registrar. They usually look like this, but **always copy the exact values Vercel shows you**:

   | Type | Name | Value |
   | --- | --- | --- |
   | A | `@` | `76.76.21.21` |
   | CNAME | `www` | `cname.vercel-dns.com` |

4. Wait until the domain shows **Valid Configuration**. That takes from a few minutes to a few hours. HTTPS is set up for you.
5. **Redeploy** once, so the share preview and sitemap use the new domain.

## Step 6: analytics (optional, free)

The code already includes Vercel Web Analytics and Speed Insights (no cookies, no banner needed). In your Vercel project, open **Analytics** and click **Enable**, then do the same under **Speed Insights**. You'll see visitors, top pages and real-user performance scores.

---

## Deploying from the terminal instead

```bash
npm install --global vercel
```

```bash
vercel login
```

```bash
vercel
```

```bash
vercel --prod
```

`vercel` makes a preview deployment and `vercel --prod` updates the live site. To test the contact form on your computer, run `vercel env pull` once, then `vercel dev` instead of `npm run dev`; `npm run dev` doesn't run the `/api` function.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| The build fails on Vercel | Open the failed deployment to read the log. In **Settings → General → Node.js Version**, pick 22.x or newer. Run `npm run build` on your computer to reproduce it. |
| `/atom` looks unstyled | Use `/atom/` with the trailing slash. `vercel.json` redirects automatically; make sure it's in the repository root. If you add another project, add a redirect for it there too. |
| The form says "Couldn't send that right now" | Check both environment variables, then redeploy. In Vercel go to **Logs**, filter by `/api/contact` and look for `Resend error`. Remember the own-email limit described in Step 4. |
| Changes don't appear | Check the deployment finished under **Deployments**, then hard-refresh with Ctrl+Shift+R (Cmd+Shift+R on a Mac). |
| The showreel doesn't play | `public/media/showreel.mp4` must be committed. Re-create it with `npm run showreel:render`. |
