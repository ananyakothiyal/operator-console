# Operator Console

A small working tool built as a work sample for the InstaLILY "Operator, Office of the CEO"
application. Paste messy input (notes, a transcript, scattered updates) and it generates one of
three formats — a leadership digest, a board update, or town hall talking points — then saves the
result straight to a Notion database.

It's a real, standalone app: a static frontend plus a serverless backend that holds your API keys
securely. Nothing runs inside a chat tool — once deployed, it has its own URL.

## How it's built

- `index.html` — the frontend. No API keys live here.
- `api/generate-brief.js` — a serverless function that calls the Claude API to generate the brief,
  then pushes it into Notion. Your keys stay server-side, in environment variables, never in
  browser code.
- Deployed on Vercel, connected to a GitHub repo.

## Step 1 — Get an Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com) and sign in or create an account.
   (This is separate from claude.ai — it's billed per API call, pay-as-you-go, with a free starter
   credit on new accounts.)
2. Go to **API Keys** in the left sidebar → **Create Key**.
3. Copy the key (starts with `sk-ant-...`). You won't be able to see it again, so save it somewhere
   safe for now — you'll paste it into Vercel in Step 4.

## Step 2 — Set up Notion

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations) → **New integration**.
   Give it a name like "Operator Console," select your workspace, and create it.
2. Copy the **Internal Integration Token** (starts with `secret_...`) — this is your `NOTION_TOKEN`.
3. In Notion, create a new database (a page → `/database` → Table). Add these two properties
   exactly as named:
   - `Name` — Title (this one exists by default)
   - `Mode` — Select, with three options: `Leadership digest`, `Board update`,
     `Town hall talking points`
4. Open the database, click **...** in the top right → **Connections** → connect the integration
   you just created. This step is easy to miss — without it, the API call will fail with a 404.
5. Copy the database ID from its URL. A Notion database URL looks like:
   `https://www.notion.so/myworkspace/DATABASE_ID?v=...` — the `DATABASE_ID` is a 32-character
   string of letters and numbers. That's your `NOTION_DATABASE_ID`.

## Step 3 — Push this project to GitHub

1. Create a new, empty repository on [github.com](https://github.com) (don't initialize it with a
   README — you already have one here).
2. From inside this project folder, run:
   ```bash
   git init
   git add .
   git commit -m "Operator Console"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
   git push -u origin main
   ```

## Step 4 — Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign up/log in with your GitHub account.
2. Click **Add New → Project**, and import the repository you just pushed.
3. Leave the build settings as-is (Vercel auto-detects this as a static site with serverless
   functions — no framework preset needed).
4. Before clicking Deploy, open **Environment Variables** and add all three:
   - `ANTHROPIC_API_KEY` → your key from Step 1
   - `NOTION_TOKEN` → your token from Step 2
   - `NOTION_DATABASE_ID` → your database ID from Step 2
5. Click **Deploy**. In about a minute, Vercel gives you a live URL like
   `https://your-project-name.vercel.app`.

## Step 5 — Test it

Open your live URL, click **Load sample input**, pick a mode, and click **Generate brief**. You
should see a formatted brief appear, and — if Notion is set up correctly — a "View in Notion →"
link that opens the new page in your database.

If something fails, check the error message shown in the app first, then check
**Vercel dashboard → your project → Deployments → (latest) → Functions → generate-brief → Logs**
for the actual server-side error.

## Common issues

- **"Notion push failed" in the logs, but the brief still shows up** — almost always means the
  integration wasn't connected to the database (see Step 2.4), or the `Mode` select property is
  missing one of the three exact option names.
- **500 error on generate** — check that all three environment variables are set in Vercel with no
  extra spaces, then redeploy (env var changes require a redeploy to take effect).
- **Local testing** — copy `.env.example` to `.env.local`, fill in real values, then run
  `npx vercel dev` from the project folder.

## Customizing further

- Add more modes by adding another entry to the `MODES` object in **both**
  `api/generate-brief.js` (for the system prompt) and `index.html` (for the button, placeholder,
  and sample text) — keep the `mode` key identical in both places.
- Add your name/contact info in a small footer line in `index.html` if you want the deployed link
  to double as a signed work sample.
