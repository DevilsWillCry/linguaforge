# Graph Report - own-english-app  (2026-11-05)

## Corpus Check
- 184 files · ~106,728 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: .example 1, (none) 1, .css 1)

## Summary
- 1701 nodes · 4015 edges · 96 communities (92 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 60 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1eee5bbd`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- SettingsPage.vue
- reminders.ts
- devDependencies
- server/package.json
- rows.ts
- compilerOptions
- scripts
- compilerOptions
- LinguaForge
- AppShell.vue
- pnpm-workspace.yaml
- CLAUDE.md
- ImportDialog.vue
- DataSettings.vue
- vue-i18n
- ai/enrichment.ts
- TodayPage.vue
- QuickAddDialog.vue
- dependencies
- @playwright/test
- CommandPalette.vue
- DraftReview.vue
- scripts
- enrichmentApi.ts
- TableCell.vue
- library.spec.ts
- PracticePanel.vue
- todayStore.ts
- duplicates.test.ts
- StatsPage.vue
- TableView.vue
- enrichmentQueue.test.ts
- OwnExampleCoach.vue
- fieldVisuals.ts
- spreadsheet.test.ts
- enrichment.spec.ts
- analytics.ts
- KanbanView.vue
- rows.test.ts
- AiSettings.vue
- EnrichmentPage.vue
- db.test.ts
- readingStore.ts
- review.ts
- domain/types.ts
- Entry
- LibrarySources.vue
- analytics.test.ts
- createApp
- createKokoroEngine
- Entry
- client.ts
- voiceStore.ts
- PlayerFrame.vue
- video.test.ts
- reading.test.ts
- libraryStore.ts
- ai/tutor.ts
- domain/tutor.test.ts
- repositories.ts
- VideoPage.vue
- EntryEditor.vue
- videoStore.ts
- tutorStore.ts
- AiSettingsStore
- tutor.spec.ts
- video.spec.ts
- app.test.ts
- review.spec.ts
- voice.spec.ts
- notify
- VideoRepository
- anki.ts
- ReviewPage.vue
- ChatPanel.vue
- TranscriptPanel.vue
- i18n.ts
- OutputTask.vue
- ExportDialog.vue
- LibraryPage.vue
- ActivityHeatmap.vue
- useVideoStore
- enrichmentStore.ts
- vue
- vue
- vite.config.ts
- ForecastChart.vue
- web/package.json
- reading.spec.ts
- stats.spec.ts
- DuplicatesDialog.vue
- TutorPage.vue
- FieldInput.vue
- useToasts.ts

## God Nodes (most connected - your core abstractions)
1. `vue` - 67 edges
2. `Entry` - 64 edges
3. `notify()` - 58 edges
4. `vue-i18n` - 51 edges
5. `Deck` - 37 edges
6. `useLibraryStore` - 35 edges
7. `EntryRepository` - 32 edges
8. `createApp()` - 30 edges
9. `useEnrichmentStore` - 27 edges
10. `lucide-vue-next` - 26 edges

## Surprising Connections (you probably didn't know these)
- `Secrets and users` --references--> `AiSettingsStore`  [INFERRED]
  README.md → apps/server/src/ai/settings.ts
- `Secrets and users` --references--> `resolveUserId()`  [INFERRED]
  README.md → apps/server/src/auth.ts
- `useVoiceStore` --indirect_call--> `download()`  [INFERRED]
  apps/web/src/features/voice/voiceStore.ts → apps/web/e2e/library.spec.ts
- `useReminderStore` --indirect_call--> `setTime()`  [INFERRED]
  apps/web/src/features/reminders/reminderStore.ts → apps/web/e2e/video.spec.ts
- `freshDb()` --calls--> `LinguaForgeDb`  [EXTRACTED]
  apps/web/src/data/backup.test.ts → apps/web/src/data/db.ts

## Import Cycles
- None detected.

## Communities (96 total, 4 thin omitted)

### Community 0 - "SettingsPage.vue"
Cohesion: 0.19
Nodes (10): mode, ThemeMode, useTheme(), locales, { mode }, review, reviewLimit, { t } (+2 more)

### Community 1 - "reminders.ts"
Cohesion: 0.09
Nodes (20): port, createFileReminderStore(), createMemoryReminderStore(), createReminderService(), deliver(), isDue(), isGone(), localClock() (+12 more)

### Community 2 - "devDependencies"
Cohesion: 0.14
Nodes (14): devDependencies, fake-indexeddb@^6.2.7, @playwright/test@^1.64.1, tailwindcss@^4.3.4, typescript@^6.0.3, vitest@^5.1.0, vue-tsc@^3.3.14, workbox-build@^7.4.1 (+6 more)

### Community 3 - "server/package.json"
Cohesion: 0.07
Nodes (35): dependencies, hono@^4.13.16, @hono/node-server@^2.1.6, jsdom@^30.1.3, @mozilla/readability@^0.6.0, web-push@3.6.7, zod@^4.6.7, devDependencies (+27 more)

### Community 4 - "rows.ts"
Cohesion: 0.13
Nodes (26): near(), planImport(), applyRowToEntry(), cellToPatch(), editPatch(), isListTarget(), isUnfilled(), LIST_TARGETS (+18 more)

### Community 5 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noUncheckedIndexedAccess (+7 more)

### Community 6 - "scripts"
Cohesion: 0.17
Nodes (11): engines, node, name, private, scripts, build, dev, test (+3 more)

### Community 7 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, module, moduleResolution, noEmit, noUncheckedIndexedAccess, skipLibCheck, strict, target (+2 more)

### Community 8 - "LinguaForge"
Cohesion: 0.11
Nodes (18): AI enrichment, AI Tutor, Capturing from other sites, Commands, Installing and offline use, LinguaForge, Progress and plans, Project layout (+10 more)

### Community 9 - "AppShell.vue"
Cohesion: 0.12
Nodes (14): @vueuse/core@^15.0.0, capture, CommandPalette, dialogsWanted, enrichment, EntryEditor, isMac, library (+6 more)

### Community 10 - "pnpm-workspace.yaml"
Cohesion: 0.29
Nodes (6): allowBuilds, esbuild, onnxruntime-node, protobufjs, sharp, packages

### Community 12 - "ImportDialog.vue"
Cohesion: 0.09
Nodes (28): autoMapHeaders(), canImport(), guessDeck(), HEADER_ALIASES, HeaderMapping, normalizeHeader(), remapRows(), unmappedHeaders() (+20 more)

### Community 13 - "DataSettings.vue"
Cohesion: 0.11
Nodes (23): Backup, backupProblem(), createBackup(), deleteEverything(), isObject(), restoreBackup(), freshDb(), open (+15 more)

### Community 14 - "vue-i18n"
Cohesion: 0.13
Nodes (13): { t }, library, props, summary, { t }, { t }, BARS, color (+5 more)

### Community 15 - "ai/enrichment.ts"
Cohesion: 0.08
Nodes (32): AiProvider, AiUsage, asEnum(), enrichEntries(), ENRICHMENT_SYSTEM_PROMPT, enrichmentOutputSchema(), EnrichmentResult, EnrichRequest (+24 more)

### Community 16 - "TodayPage.vue"
Cohesion: 0.12
Nodes (19): EntryCounts, dayKey(), outputDays(), outputStreak(), didOutputToday, outputs, streak, clock (+11 more)

### Community 17 - "QuickAddDialog.vue"
Cohesion: 0.18
Nodes (12): capture, closeCapturePopup(), library, openEntry(), { quickAddOpen }, router, save(), similar (+4 more)

### Community 18 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, dexie@^4.4.7, @fontsource-variable/inter@^5.3.0, @fontsource-variable/jetbrains-mono@^5.3.0, @huggingface/transformers@3.8.1, lucide-vue-next@^1.0.0, vue@^3.5.44, vue-i18n@^11.4.18 (+7 more)

### Community 19 - "@playwright/test"
Cohesion: 0.15
Nodes (3): @axe-core/playwright@^4.14.0, @axe-core/playwright, @playwright/test

### Community 20 - "CommandPalette.vue"
Cohesion: 0.11
Nodes (19): pinia@^4.1.0, NAV_ITEMS, EntrySource, LibrarySource, CaptureDetails, useCaptureStore, activeIndex, capture (+11 more)

### Community 21 - "DraftReview.vue"
Cohesion: 0.09
Nodes (36): appendOwnExample(), confirmPatch(), DRAFT_FIELDS, draftCell(), DraftField, enrichmentRequest(), initialCells(), isDraftField() (+28 more)

### Community 22 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, preview, test, test:e2e, test:watch, typecheck

### Community 23 - "enrichmentApi.ts"
Cohesion: 0.25
Nodes (10): AiModelOption, AiProviderId, AiSettingsView, fetchAiModels(), fetchAiSettings(), KNOWN_CODES, post(), requestFeedback() (+2 more)

### Community 24 - "TableCell.vue"
Cohesion: 0.16
Nodes (13): control(), display, draft, editing, fieldLabel, finish(), isMultiline, library (+5 more)

### Community 25 - "library.spec.ts"
Cohesion: 0.27
Nodes (5): download(), entries(), entry(), openImport(), openLibrary()

### Community 26 - "PracticePanel.vue"
Cohesion: 0.12
Nodes (21): clozeTargets(), average, blankResult(), blanks, check(), checked, cue, DIFF_CLASSES (+13 more)

### Community 27 - "todayStore.ts"
Cohesion: 0.18
Nodes (16): studySessionRepository, DEFAULT_WEEKLY_TARGETS, INTENSITIES, Intensity, PATHS, planMinutes(), SESSION_PLANS, SessionPlanId (+8 more)

### Community 28 - "duplicates.test.ts"
Cohesion: 0.31
Nodes (10): areNearDuplicates(), editDistance(), ENRICHMENT_RANK, findDuplicatePairs(), mergeEntries(), pairKey(), stemKey(), stemToken() (+2 more)

### Community 29 - "StatsPage.vue"
Cohesion: 0.11
Nodes (20): dueForecast(), recentMistakes(), statusFunnel(), usedInOutput(), props, scale, data, dimension (+12 more)

### Community 30 - "TableView.vue"
Cohesion: 0.11
Nodes (15): ariaSort(), canScroll, { canScrollLeft, canScrollRight, panning, scrollByPage }, columns, fieldLabel, isPinned(), library, pinnedEdge (+7 more)

### Community 31 - "enrichmentQueue.test.ts"
Cohesion: 0.12
Nodes (15): ENRICH_BATCH_SIZE, EnrichmentDraft, EnrichRequest, EnrichResponse, ENTRY_PROBLEMS, PauseQueue, QueueDeps, QueueResult (+7 more)

### Community 32 - "OwnExampleCoach.vue"
Cohesion: 0.15
Nodes (15): feedbackTarget(), sameSentence(), SentenceFeedback, add(), ask(), asking, emit, enrichment (+7 more)

### Community 33 - "fieldVisuals.ts"
Cohesion: 0.11
Nodes (27): CONTEXTS, ENTRY_KINDS, TONES, hiddenCount, items, props, shownItems, sourceLabel (+19 more)

### Community 34 - "spreadsheet.test.ts"
Cohesion: 0.15
Nodes (20): parseCsv(), ParsedSheet, parseSpreadsheetFile(), parseXlsx(), readWorkbook(), safeSheetName(), SheetData, cases (+12 more)

### Community 35 - "enrichment.spec.ts"
Cohesion: 0.25
Nodes (14): aiOn(), draftItems(), FEEDBACK, hangAfterFirstBatch(), Item, itemsOf(), mockEnrichment(), mockSettings() (+6 more)

### Community 36 - "analytics.ts"
Cohesion: 0.16
Nodes (17): AccuracyRow, activityCalendar(), addDays(), EntryFacts, FocusSuggestion, FUNNEL_STATUSES, LogFacts, MIN_ANSWERS (+9 more)

### Community 37 - "KanbanView.vue"
Cohesion: 0.25
Nodes (7): columns, dropTarget, library, move(), onDrop(), statusField, { t }

### Community 38 - "rows.test.ts"
Cohesion: 0.12
Nodes (21): ENGLISH_DECK_ID, ENGLISH_SCHEMA, VUE_DECK_ID, VUE_SCHEMA, deck, entry(), NOW, vueDeck (+13 more)

### Community 39 - "AiSettings.vue"
Cohesion: 0.08
Nodes (29): resetAiSettings(), saveAiSettings(), apiKey, applySaved(), baseUrl, budgetInput, busy, canSave (+21 more)

### Community 40 - "EnrichmentPage.vue"
Cohesion: 0.15
Nodes (10): canRetry, enrichment, isEmpty, library, route, selected, selectedDeck, selectedId (+2 more)

### Community 41 - "db.test.ts"
Cohesion: 0.26
Nodes (10): nanoid@^6.0.2, createV1Db(), freshDb(), open, pendingEntry(), setUp(), upgraded(), createDeckRepository() (+2 more)

### Community 42 - "readingStore.ts"
Cohesion: 0.17
Nodes (20): findSentence(), readingParagraphs(), ReadingSentence, readingStats(), sentenceSegmenter, splitSentences(), deck, NOW (+12 more)

### Community 43 - "review.ts"
Cohesion: 0.17
Nodes (15): ts-fsrs@^6.0.0, applyReview(), isCorrect(), LEECH_LAPSES, nextStatus(), ReviewAnswer, ReviewRating, scheduler (+7 more)

### Community 44 - "domain/types.ts"
Cohesion: 0.16
Nodes (11): SavedViewRepository, LibraryFilters, SortKey, EntryKind, EntryStats, FieldType, IMPORTANCE_LEVELS, IsoDate (+3 more)

### Community 45 - "Entry"
Cohesion: 0.13
Nodes (5): EntryRepository, ImportPlan, PhraseIndex, Enrichment, Entry

### Community 46 - "LibrarySources.vue"
Cohesion: 0.06
Nodes (43): videoRepository, cleanWebLink(), librarySources(), linkedSource(), sourceDestination(), SourceKind, videoIdOfSource(), webSearchUrl() (+35 more)

### Community 47 - "analytics.test.ts"
Cohesion: 0.22
Nodes (12): accuracyBy(), isCorrect(), nextFocus(), retention(), tally(), at(), log(), NOW (+4 more)

### Community 48 - "createApp"
Cohesion: 0.08
Nodes (30): ProviderId, AiSettingsInput, aiSettingsInputSchema, cleanBaseUrl(), createFileStore(), readAll(), update(), createLocalSettings() (+22 more)

### Community 49 - "createKokoroEngine"
Cohesion: 0.08
Nodes (35): kokoro-js@1.2.1, downloadVoices(), line, load(), reply(), speak(), VoiceName, Clip (+27 more)

### Community 50 - "Entry"
Cohesion: 0.08
Nodes (44): AnswerResult, checkAnswer(), ClozePart, editDistance(), makeCloze(), redactTarget(), sameWord(), stem() (+36 more)

### Community 51 - "client.ts"
Cohesion: 0.10
Nodes (29): openai@^7.48.0, AiErrorCode, AiFailure, codeForStatus(), JsonRequest, parseJsonOutput(), STATUS_BY_CODE, statusFor() (+21 more)

### Community 52 - "voiceStore.ts"
Cohesion: 0.17
Nodes (19): accents, browserVoiceFound, naturalActive, percent, { t }, voice, englishVoices(), hasBrowserVoice() (+11 more)

### Community 53 - "PlayerFrame.vue"
Cohesion: 0.10
Nodes (13): createHtmlPlayer(), createYouTubePlayer(), loadYouTubeApi(), Window, YouTubeApi, YouTubePlayer, failed, onFileReady() (+5 more)

### Community 54 - "video.test.ts"
Cohesion: 0.18
Nodes (14): wordsOf(), cueIndexAt(), buildPhraseIndex(), DiffKind, DiffWord, diffWords(), prefixOf(), segmentLine() (+6 more)

### Community 55 - "reading.test.ts"
Cohesion: 0.19
Nodes (10): fetchOnce(), fetchPublicPage(), INTERNAL, isPublicAddress(), PageError, PageErrorCode, parsePageUrl(), publicOnlyLookup() (+2 more)

### Community 56 - "libraryStore.ts"
Cohesion: 0.16
Nodes (23): savedViewRepository, activeFilterCount(), allows(), DEFAULT_SORT, emptyFilters(), haystackOf(), haystacks, isDueToday() (+15 more)

### Community 57 - "ai/tutor.ts"
Cohesion: 0.14
Nodes (16): OUTPUT_SYSTEM_PROMPT, outputOutputSchema, OutputRequest, outputRequestSchema, OutputReview, reviewOutput(), runTutorTurn(), ScenarioId (+8 more)

### Community 58 - "domain/tutor.test.ts"
Cohesion: 0.24
Nodes (12): urgency(), historyPayload(), pickTargets(), TARGET_COUNT, targetPayload(), card(), deck, later() (+4 more)

### Community 59 - "repositories.ts"
Cohesion: 0.16
Nodes (11): LIST_FIELDS, db, LinguaForgeDb, StatsSnapshot, StudySessionRepository, TutorRepository, DECK_PRESETS, Mistake (+3 more)

### Community 60 - "VideoPage.vue"
Cohesion: 0.17
Nodes (13): parseYouTubeId(), backToList(), heading, link, linkError, numberParam(), openLink(), recent (+5 more)

### Community 61 - "EntryEditor.vue"
Cohesion: 0.11
Nodes (17): formatSource(), safeHttpUrl(), FieldDef, cells, deck, entry, fieldLabel, ipa (+9 more)

### Community 62 - "videoStore.ts"
Cohesion: 0.18
Nodes (16): cleanText(), ENTITIES, formatTime(), parsePlain(), parseSubtitles(), parseTimed(), removeRollingRepeats(), seconds() (+8 more)

### Community 63 - "tutorStore.ts"
Cohesion: 0.21
Nodes (13): tutorRepository, TutorCorrection, TutorMessage, AiRequestError, AiUsage, post(), requestOutputReview(), requestTutorTurn() (+5 more)

### Community 64 - "AiSettingsStore"
Cohesion: 0.33
Nodes (3): AiSettingsStore, resolveUserId(), Secrets and users

### Community 65 - "tutor.spec.ts"
Cohesion: 0.20
Nodes (7): CORRECTED, entryNamed(), mockTutor(), OPENING, openTask(), stored(), USAGE

### Community 66 - "video.spec.ts"
Cohesion: 0.18
Nodes (5): cue(), FakeYt, setTime(), TRANSCRIPT, word()

### Community 67 - "app.test.ts"
Cohesion: 0.18
Nodes (6): @anthropic-ai/sdk@^1.4.0, ENV, ITEMS, NOTE, OPTIONS, @anthropic-ai/sdk

### Community 68 - "review.spec.ts"
Cohesion: 0.27
Nodes (7): answerAndGrade(), answerBox(), card(), modeOf(), openReview(), patchEntry(), toUseIt()

### Community 69 - "voice.spec.ts"
Cohesion: 0.20
Nodes (3): Failure, settings(), turnOnNaturalVoice()

### Community 70 - "notify"
Cohesion: 0.13
Nodes (19): deckRepository, bookmarklet, copy(), { t }, add(), deck, deckId, fieldLabel (+11 more)

### Community 71 - "VideoRepository"
Cohesion: 0.29
Nodes (4): VideoRepository, MediaKey, Transcript, VideoSession

### Community 72 - "anki.ts"
Cohesion: 0.46
Nodes (7): escapeHtml(), HIDDEN_ON_CARD, renderField(), toAnkiText(), toCardHtml(), parseArrowList(), CoreField

### Community 73 - "ReviewPage.vue"
Cohesion: 0.12
Nodes (15): BrandIcon, NavItem, router, capture, route, answerInput, enrichment, isTypingCard (+7 more)

### Community 74 - "ChatPanel.vue"
Cohesion: 0.20
Nodes (9): box, draft, list, mic, onKey(), send(), { t }, tutor (+1 more)

### Community 75 - "TranscriptPanel.vue"
Cohesion: 0.27
Nodes (10): captureWordAt(), cueIndexOf(), list, load(), onFile(), onWordKey(), onWordsPointerUp(), pasted (+2 more)

### Community 76 - "i18n.ts"
Cohesion: 0.33
Nodes (6): applyLocale(), i18n, Locale, locale, en, es

### Community 77 - "OutputTask.vue"
Cohesion: 0.14
Nodes (9): wordCount(), { t }, text, tutor, words, Recognition, RecognitionClass, recognitionClass() (+1 more)

### Community 78 - "ExportDialog.vue"
Cohesion: 0.17
Nodes (9): DeckRepository, deck, exporters, library, open, run(), sheetFor(), sortedEntries() (+1 more)

### Community 79 - "LibraryPage.vue"
Cohesion: 0.09
Nodes (20): reka-ui@^2.11.0, selected, allTags, FACETS, library, PRIORITIES, { t }, viewName (+12 more)

### Community 80 - "ActivityHeatmap.vue"
Cohesion: 0.20
Nodes (9): ActivityCell, activeDays, asDate(), hovered, LEVELS, props, scroller, { t } (+1 more)

### Community 82 - "enrichmentStore.ts"
Cohesion: 0.42
Nodes (8): canAutoEnrich(), needsManualText(), fetchAiConfigured(), requestEnrichment(), DEFAULT_DAILY_TOKENS, localDay(), useEnrichmentStore, withQueueLock()

### Community 83 - "vue"
Cohesion: 0.29
Nodes (8): statsRepository, JSON_HEADERS, keyBytes(), serviceWorker(), useReminderStore, reminders, { t }, vue

### Community 84 - "vue"
Cohesion: 0.18
Nodes (9): emit, props, { t }, text, color, dash, props, stage (+1 more)

### Community 85 - "vite.config.ts"
Cohesion: 0.20
Nodes (8): @tailwindcss/vite@^4.3.4, vite@^8.3.5, vite-plugin-pwa@2.0.0, @vitejs/plugin-vue@^6.0.10, @tailwindcss/vite, vite, vite-plugin-pwa, @vitejs/plugin-vue

### Community 87 - "ForecastChart.vue"
Cohesion: 0.24
Nodes (9): ForecastDay, active, asDate(), hovered, max, props, shortDay(), { t } (+1 more)

### Community 88 - "web/package.json"
Cohesion: 0.22
Nodes (8): @types/node@^26.6.6, workbox-window@^7.4.1, @types/node, name, private, type, version, workbox-window

### Community 89 - "reading.spec.ts"
Cohesion: 0.32
Nodes (5): ARTICLE, article(), mockArticle(), openArticle(), word()

### Community 90 - "stats.spec.ts"
Cohesion: 0.33
Nodes (3): answer(), daysAgo(), Seed

### Community 91 - "DuplicatesDialog.vue"
Cohesion: 0.25
Nodes (6): entryRepository, DuplicatePair, library, open, run(), { t }

### Community 92 - "TutorPage.vue"
Cohesion: 0.29
Nodes (6): enrichment, { t }, tab, TABS, tutor, SCENARIO_IDS

### Community 94 - "FieldInput.vue"
Cohesion: 0.33
Nodes (5): options, PRIORITIES, props, value, isCodeField()

### Community 95 - "useToasts.ts"
Cohesion: 0.60
Nodes (4): runAction(), dismissToast(), Toast, toasts

## Knowledge Gaps
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vue` connect `vue` to `SettingsPage.vue`, `AppShell.vue`, `ImportDialog.vue`, `DataSettings.vue`, `vue-i18n`, `TodayPage.vue`, `QuickAddDialog.vue`, `dependencies`, `CommandPalette.vue`, `DraftReview.vue`, `TableCell.vue`, `PracticePanel.vue`, `todayStore.ts`, `StatsPage.vue`, `TableView.vue`, `OwnExampleCoach.vue`, `fieldVisuals.ts`, `KanbanView.vue`, `AiSettings.vue`, `EnrichmentPage.vue`, `readingStore.ts`, `LibrarySources.vue`, `Entry`, `voiceStore.ts`, `PlayerFrame.vue`, `video.test.ts`, `libraryStore.ts`, `VideoPage.vue`, `EntryEditor.vue`, `videoStore.ts`, `tutorStore.ts`, `notify`, `ReviewPage.vue`, `ChatPanel.vue`, `TranscriptPanel.vue`, `i18n.ts`, `OutputTask.vue`, `ExportDialog.vue`, `LibraryPage.vue`, `ActivityHeatmap.vue`, `enrichmentStore.ts`, `vue`, `ForecastChart.vue`, `web/package.json`, `DuplicatesDialog.vue`, `TutorPage.vue`, `FieldInput.vue`, `useToasts.ts`?**
  _High betweenness centrality (0.116) - this node is a cross-community bridge._
- **Should `reminders.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0907258064516129 - nodes in this community are weakly interconnected._
- **Why does `Entry` connect `Entry` to `rows.ts`, `ImportDialog.vue`, `vue-i18n`, `QuickAddDialog.vue`, `DraftReview.vue`, `TableCell.vue`, `duplicates.test.ts`, `enrichmentQueue.test.ts`, `OwnExampleCoach.vue`, `fieldVisuals.ts`, `spreadsheet.test.ts`, `analytics.ts`, `KanbanView.vue`, `rows.test.ts`, `EnrichmentPage.vue`, `readingStore.ts`, `review.ts`, `domain/types.ts`, `LibrarySources.vue`, `Entry`, `video.test.ts`, `libraryStore.ts`, `domain/tutor.test.ts`, `repositories.ts`, `EntryEditor.vue`, `videoStore.ts`, `tutorStore.ts`, `anki.ts`, `enrichmentStore.ts`, `DuplicatesDialog.vue`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Why does `useReadingStore` connect `readingStore.ts` to `rows.ts`, `notify`, `LibrarySources.vue`, `ai/enrichment.ts`, `enrichmentStore.ts`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Should `server/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.07301587301587302 - nodes in this community are weakly interconnected._
- **Should `rows.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13054187192118227 - nodes in this community are weakly interconnected._