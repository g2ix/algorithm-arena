# Algorithm Arena

A live classroom tournament for **CIS 2101 Trees & Graphs**. Teams join from their phones with a game code, answer on a shared team pad, and get scored automatically; the projector shows a live leaderboard. The teacher runs everything from a control screen and encodes CodeChum (R4) and Bug Hunt (R5) points by hand.

- **Next.js 16** (App Router, TypeScript, Tailwind CSS 4) on **Vercel**
- **Supabase Postgres** for data, **Supabase Realtime** for instant screen updates (falls back to polling)
- No student accounts: a game code plus first name

## What each person sees

| Page | Who | What |
|---|---|---|
| `/` | Everyone | Enter the game code |
| `/join` | Students | Type a name, pick or create a team |
| `/play` | Students | Team answer pad: the question, timer, answer boxes, wager buttons (R3), power-up cards, and the result after reveal |
| `/team` | Students | Team dashboard: score, rank, points by round, members, score history |
| `/board/CODE` | Projector | Live leaderboard, current question, timer, join QR code, confetti on lead changes |
| `/admin` | Teacher | Classes and games |
| `/admin/session/ID` | Teacher | Game control, R4/R5 encoding, teams, power-ups and manual points |
| `/admin/reports/CLASS_ID` | Teacher | Percent correct per question and final standings, with CSV export |
| `/admin/items` | Teacher | Edit the question bank (prompts, answer keys, points, timers) |

## Deploy to Vercel (about 15 minutes)

1. **Put the code on GitHub.** Create an empty repository (for example `algorithm-arena`), then from this folder:
   ```bash
   git remote add origin https://github.com/YOUR-USERNAME/algorithm-arena.git
   git push -u origin main
   ```
2. **Import into Vercel.** On vercel.com choose **Add New → Project**, pick the repository, and click **Deploy**. The first deploy builds fine, but the site shows a database error until step 3 is done.
3. **Add the database.** In the Vercel project open **Storage**, click **Create Database**, choose **Supabase**, and connect it to this project (all environments). Vercel adds the database URL and Supabase keys to the project automatically.
4. **Add your own two secrets** in **Settings → Environment Variables**:
   - `ADMIN_PASSWORD`: your teacher login password
   - `SESSION_SECRET`: any long random text (32+ characters)
5. **Redeploy** (Deployments → ⋯ → Redeploy) so the new variables take effect.
6. **Open `https://your-app.vercel.app/admin`**, log in, and add your 3 classes. The tables and the question bank are created automatically on first use; you don't need to run any SQL.

### If the Supabase variables have different names

The app reads these variables. If your integration named them differently, copy the values from the Supabase dashboard into these names:

| Variable | Where to find it in Supabase |
|---|---|
| `POSTGRES_URL` (or `DATABASE_URL`) | Project Settings → Database → Connection string → **Transaction pooler** (port 6543) |
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) | Project Settings → API → anon / publishable key |

The two `NEXT_PUBLIC_` values only enable instant updates. Without them the screens refresh every 2.5 seconds, which still works fine in class.

### Keeping the free database awake

Supabase pauses free projects after about a week with little activity. `vercel.json` schedules a daily call to `/api/keep-alive` to prevent that. If it does pause (for example over a long break), open the Supabase dashboard and click **Resume project**.

## Running a game

1. **Admin → Start a new game:** choose the class and whether you make the teams or students do. The game gets a 6-letter code.
2. **Open the projector board** from the control screen. Students scan the QR code or go to the site and type the code.
3. **For each item** in the control screen: pick it on the left → (R3: **Start wagers**) → **Open answering** → **Reveal & score** → **Next**.
4. Use **✓ / ✗** beside any answer to accept a valid alternative or reject one; scores are recalculated instantly.
5. **Encode R4 / R5:** tick CodeChum problems as teams pass them, tap ⭐ for the first solver, and tap the team that wins each bug.
6. **Power-ups & points:** approve Double Down / Steal requests and add or remove points with a reason (for example a Steal). Every other card runs by itself.
7. **End game** shows the champion on the board. Download the CSV from the control screen or the class report.

### Scoring rules (editable per item in the question bank)

| Round | Rule |
|---|---|
| R1 Trace Race | First correct +3, other correct +1, wrong −1 |
| R2 Human Tree | First correct +4, other correct +2 (teams type the preorder or heap array of what they built) |
| R3 Map Heist | Correct + wager, wrong − wager; no wager locked counts as 1 |
| R4 Code Sprint | Bronze 5, Silver 10, Gold 15, Platinum 20, +3 first solver |
| R5 Bug Hunt | +5 to the team you tap |

### Power-up cards (each team plays one per game)

| Card | Effect | Teacher OK? |
|---|---|---|
| 🛟 Lifeline | The system checks the team's current draft and gives a hint (e.g. "first 3 items are right; the 4th is where it goes wrong", "too high", "C-E is not one of the roads") without revealing missing answer pieces | No |
| 🔁 Second Chance | Erases the team's submitted answer while answering is open so they can resubmit (new time) | No |
| ⚡ Fast Pass | A correct answer on the next R1/R2 item earns first-place points | No |
| 2× Double Down | Doubles the team's result on the next R1/R2 item you reveal, win or lose | Yes |
| 🛡️ Shield | Cancels any net loss on the next R1/R2/R3 item revealed (wrong answer or lost wager) | No |
| 🎰 High Roller | Raises the wager cap from 5 to 10 on the next Map Heist item | No |
| 🦝 Steal | The team tries an item another team got wrong; you award points with an adjustment | Yes |

The projector shows a big announcement whenever a team plays a card.

Only a team's **first** submission counts, judged by the server's clock. Answers are flexible: `A, B, D`, `a b d`, `A→B→D` and `ABD` all match `A B D`; road lists like `F-C, I-A` match in any order; cycles match in any rotation.

## Local development

Requires Node 20+ and a Postgres database.

```bash
npm install
cp .env.example .env.local      # then set DATABASE_URL, ADMIN_PASSWORD, SESSION_SECRET
npm run dev                     # http://localhost:3000
npm test                        # answer-checker and scoring tests
```

## Project layout

```text
app/                  pages and API routes (app/api/...)
components/           shared UI, projector effects, view types
lib/checkers.ts       answer normalizing and checking
lib/scoring.ts        points per round, ranks, power-up effects
lib/hints.ts          Lifeline hints from a team's draft answer
lib/game.ts           all game logic and database queries
lib/db.ts             Postgres connection + automatic setup
lib/schema.ts         tables (also in supabase/migrations/001_init.sql)
lib/seed.ts           the question bank from the activity doc
public/figures/       tree and graph images
tests/                unit tests
```

## Security notes

- Answer keys never leave the server until an item is revealed.
- Row Level Security is enabled on every table; browsers may only read the `game_state` table (no secrets in it) to receive live updates. All writes go through the app's server.
- The teacher login is a signed, HTTP-only cookie. Choose a strong `ADMIN_PASSWORD`.
