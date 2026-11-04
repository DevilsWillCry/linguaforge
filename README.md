# LinguaForge

A local-first English training app (PWA) for one user. It focuses on active recall, speaking and writing practice, and a high volume of comprehensible video input. Your spreadsheet becomes the Library, and every other module reads from it and writes back to it.

**Current status: Phase 1.** The Library replaces the spreadsheet: Quick Add, table, cards and Kanban views, search and filters, CSV and XLSX import and export, Anki export, duplicate merging and backups all work. Today only shows counts, and the other modules are placeholders.

## Requirements

- Node.js 22.9 or later
- pnpm

## Run it

```bash
pnpm install
cp .env.example .env   # optional for now: no feature uses the API key yet
pnpm dev
```

- App: http://localhost:5173
- API health check: http://localhost:5173/api/health

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Starts the web app and the API |
| `pnpm test` | Runs the Vitest tests for both apps |
| `pnpm typecheck` | Type-checks both apps |
| `pnpm build` | Type-checks and builds for production |
| `pnpm test:e2e` | Runs the Playwright tests on desktop and mobile |

Before the first `pnpm test:e2e`, install the browser once:

```bash
pnpm --filter @linguaforge/web exec playwright install chromium
```

## Project layout

```
apps/
  server/src/          Hono API: only for features that need a secret
  server/src/ai/       AI providers, prompts, output schemas, encrypted per-user settings
  web/
    e2e/               Playwright tests
    src/
      domain/          Pure TypeScript: types, rows, search, duplicates, import, Anki, FSRS mapping
      data/            Dexie schema, repositories, spreadsheets, backup, seed-data.json
      app/             Router, i18n, theme, design tokens
      shared/          Layout shell and UI primitives
      features/        One folder per module
```

Features use the repository interfaces in `data/repositories.ts` rather than Dexie directly, so optional cloud sync can be added later without changing them.

## Your data

Everything is stored in your browser's IndexedDB. The seed runs once, when the database is created, so entries you delete don't come back.

**Back up regularly:** clearing your browser's site data erases the library. Go to Settings > Your data > Export everything for a JSON backup, which is the only export holding review history, tags and notes. Spreadsheet exports contain just the sheet columns.

To start over from the seed, delete the `linguaforge` database in your browser's dev tools (Application > IndexedDB) and reload. **This erases everything you've added.**

### Spreadsheet round trips

CSV and XLSX exports use your sheet's exact column headers, and importing an export gives back the same data. Two things change on the way:

- Formatting is tidied: stray spaces are removed, a blank status becomes `New`, and list cells always start each item with `→`.
- The Vue deck has an extra `Importance` column. Original sheets without it still import, because importance labels in `Review Status` are moved across automatically.

Excel may treat CSV cells starting with `@` or `=`, such as `@click`, as formulas, so use XLSX if you open the Vue deck in a spreadsheet app.

### Capturing from other sites

Settings has a bookmarklet that opens `/capture?text=…&url=…&title=…`. That page only pre-fills Quick Add, and nothing is saved until you confirm, so other websites can't add entries by themselves.

## AI enrichment

Choose a service under **Ajustes > Tu IA**: OpenRouter (which has free models), Anthropic, or any OpenAI-compatible address such as Ollama. Without one, the app still works and AI stays off. On a local server, `ANTHROPIC_API_KEY` in `.env` also works, and a service saved in Settings takes priority over it.

- New entries in language decks are sent to AI automatically, up to five per request. Each one becomes a draft that stays apart from the entry until you confirm it on the **Completar con IA** page, so drafts never reach reviews or exports.
- AI receives only the entry's text and a kind hint, and for feedback your sentence with the entry's meanings, tone and context.
- **Free models:** the provider may log what you send and use it for training. Settings warns about this. Ollama keeps everything on your computer.
- AI can't fill your own examples: the output format has no field for them, and every answer is checked on the server, which drops anything extra. Feedback is shown beside your sentence, and only what you wrote gets added.
- Editing an entry while AI is working cancels that draft, so your text is never overwritten.
- An entry that fails is set aside until you press Retry. A service failure pauses the queue, and so does reaching the daily token limit in Settings. The limit defaults to 50,000 tokens and is counted in the browser.

The prompts are in `apps/server/src/ai/enrichment.ts` and `feedback.ts`. To try the enrichment prompt on real words with the AI you have set up, which may spend a little credit:

```bash
pnpm --filter @linguaforge/server enrich:try "figure out" "Shall"
```

## Reviews

Confirmed entries are scheduled with FSRS (`ts-fsrs`) and reviewed on the **Repaso** page, for the deck open in the Library. You always try first: nothing about the answer is on the page until you press Comprobar.

- **Modes:** cloze, production, listening and "use it" rotate per card. Other decks use production only. Listening needs an English voice in the browser, and is skipped with a note if there isn't one, which is common on Linux.
- **Grades:** Again, Hard, Good and Easy, with keys 1-4 and a suggested grade. `U` undoes the last answer.
- **Daily queue:** due cards, highest priority first, capped by **Tarjetas por día** in Settings and mixed so similar items don't sit together.
- **Status:** New → Learning on the first correct answer (Hard or better). Familiar needs 7 days of stability and correct answers in 2 modes. Natural needs 30 days and one correct use in your own writing, judged by AI, or by your own grade of Good or better if AI is off. Status never moves backwards on its own, and one you choose by hand stays until you press **Volver al estado automático**.
- **Leeches:** after 5 lapses, a card suggests a mnemonic, a new example or splitting the meaning, and offers to open the editor. AI-written suggestions aren't built yet.

The **Hoy** page has the guided session: start, pause, a timer and a progress rail. Input and Output are placeholders until Phases 4 and 5, and the wrap-up shows counts only until then.

## Video Lab

Paste a YouTube link, or choose a video or audio file of your own, on the **Video** page. YouTube videos play in the official embedded player and are never downloaded. Your own files stay on your computer and have to be chosen again each time.

- **Transcripts:** YouTube's official captions API only serves a video's owner, and the app doesn't scrape, so you supply them: a `.srt` or `.vtt` file, or the text copied from YouTube's "Show transcript" panel. Each one is saved in the browser, so it only loads once.
- **Your library's videos:** sources from the Source column are listed on the Video page, with a search for each. Paste a link once and it's saved on all its entries, with a shortcut in the table and the editor. The page also shows which videos already have a transcript.
- **Watching:** the current line follows playback, and clicking a time seeks. Speed goes from 0.5× to 1.5×, and you can loop between A and B or repeat a sentence.
- **Keys:** Space plays and pauses, `R` repeats, the arrows change sentence, and `A` and `B` set the loop. They don't work while focus is inside the YouTube player, so click outside it first.
- **Capturing:** click a word or drag over a phrase. It joins the Library with that sentence as a real example and that moment as its source, and saved entries get a **Reproducir el clip original** button. Items already in the Library are underlined, and clicking one shows what you know about it.
- **Practice:** Completar hides Library items, or else the longest word in the line, and Dictado scores what you type with a word-by-word comparison. The transcript is hidden in both. YouTube may still show its own captions depending on your preferences, so turn them off with CC.

## Reading Lab

Open a web page on the **Lectura** page, from its link or from a source in your Library. Sources open in the right place: YouTube links in the Video Lab and other web links here. A source with only a title offers a search, and its link only has to be pasted once.

- **Capturing** works as in the Video Lab: click a word, drag over a phrase, or type it for keyboard use. It joins the Library with that sentence as a real example and the page as its source.
- **Nothing is stored:** only the title and link of recent pages are kept. The text is fetched again each time, and pasted text lasts only while you read it.
- **If a page can't be read,** because of a login or a block, you can open it in another tab and paste the text.
- **Level:** Estimar el nivel sends the start of the text to AI for a CEFR estimate, only when you press it.
- **Safety:** the server only fetches public web pages on the normal ports. It checks every address when connecting and after each redirect, and returns plain text only, so nothing from a page runs in the app.

## Secrets and users

API keys never reach the browser. A key entered in Settings goes to the server, is encrypted with AES-256-GCM and is never returned, apart from its last four characters. A saved key only stays with the service and address it was entered for.

Everything is filed per user, with one user today:

| Piece | Today | When hosting for other people (Phase 6) |
| --- | --- | --- |
| Who is asking | `resolveUserId()` in `apps/server/src/auth.ts` returns `local` | Verify the login session there |
| Saved settings | `.data/ai-settings.json`, owner-only and git-ignored | A database version of `AiSettingsStore` |
| Encryption key | `.data/secret.key`, created automatically | `AI_SECRETS_KEY`, from a secrets manager |

Setting `LF_HOSTED=1` makes the server refuse every AI route, ignore the `.env` key and reject private addresses, so it can't be exposed by accident before logins exist. Hosting also needs these changes:

- Replace the Host and Origin checks in `app.ts`, which only allow localhost.
- Check the resolved IP of custom addresses, because the current check only sees the hostname.
- Add per-user rate limits.
- Enforce the daily token limit on the server.

The server listens on loopback only. Because a website you visit could still call a local port, the AI routes also reject other origins and hosts, and anything that isn't JSON.

## Roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Scaffold, design tokens, shell, routing, database, seed | Done |
| 1 | Library, Quick Add, lossless CSV/XLSX import and export, editable dropdowns | Done |
| 2 | AI Enrichment Queue, confirm editor, feedback on your own examples, your own AI service | Built, not yet run against a real model |
| 3 | FSRS reviews in 4 modes, status progression, Today page skeleton | Done |
| 4 | Video Lab: embed, synced transcript, click to capture, A-B loop, cloze, dictation | Done |
| 5 | AI Tutor (chat and voice), mistake capture, daily output task, Reading Lab | |
| 6 | Dashboard, intensity presets, PWA push, Supabase sync and logins, hosting for other users, polish | |
