# Graph Report - own-english-app  (2026-11-05)

## Corpus Check
- 184 files · ~106,825 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: .example 1, (none) 1, .css 1)

## Summary
- 1702 nodes · 4017 edges · 92 communities (86 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 60 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d497337e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- vue
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
- EntrySummary.vue
- ai/enrichment.ts
- TodayPage.vue
- QuickAddDialog.vue
- dependencies
- @playwright/test
- CommandPalette.vue
- DraftReview.vue
- scripts
- LibrarySources.vue
- TableCell.vue
- library.spec.ts
- WrapUpRecap.vue
- todayStore.ts
- duplicates.test.ts
- StatsPage.vue
- TableView.vue
- enrichmentQueue.test.ts
- OwnExampleCoach.vue
- fieldVisuals.ts
- spreadsheet.test.ts
- enrichment.spec.ts
- vue-i18n
- KanbanView.vue
- YouTubePlayer
- AiSettings.vue
- EnrichmentPage.vue
- repositories.ts
- readingStore.ts
- review.ts
- domain/types.ts
- Entry
- ReadingPage.vue
- SourceLink.vue
- createApp
- createKokoroEngine
- reviewStore.ts
- client.ts
- voiceStore.ts
- PlayerFrame.vue
- review.test.ts
- reading.test.ts
- libraryStore.ts
- ai/tutor.ts
- tutorStore.ts
- PriorityBars.vue
- VideoPage.vue
- EntryEditor.vue
- videoStore.ts
- TutorPage.vue
- AiSettingsStore
- tutor.spec.ts
- video.spec.ts
- app.test.ts
- review.spec.ts
- voice.spec.ts
- notify
- VideoRepository
- BarList.vue
- ReviewPage.vue
- ChatPanel.vue
- TranscriptPanel.vue
- OutputTask.vue
- DeckRepository
- LibraryPage.vue
- ActivityHeatmap.vue
- enrichmentStore.ts
- CaptureCard.vue
- vite.config.ts
- ForecastChart.vue
- web/package.json
- reading.spec.ts
- stats.spec.ts
- DuplicatesDialog.vue
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
- `PhraseIndex` --references--> `Entry`  [EXTRACTED]
  apps/web/src/domain/transcriptWords.ts → apps/web/src/domain/types.ts

## Import Cycles
- None detected.

## Communities (92 total, 6 thin omitted)

### Community 0 - "vue"
Cohesion: 0.09
Nodes (28): pinia@^4.1.0, @vueuse/core@^15.0.0, applyLocale(), i18n, Locale, locale, en, es (+20 more)

### Community 1 - "reminders.ts"
Cohesion: 0.09
Nodes (20): port, createFileReminderStore(), createMemoryReminderStore(), createReminderService(), deliver(), isDue(), isGone(), localClock() (+12 more)

### Community 2 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, fake-indexeddb@^6.2.7, @playwright/test@^1.64.1, tailwindcss@^4.3.4, typescript@^6.0.3, vitest@^5.1.0, vue-tsc@^3.3.14, typescript (+4 more)

### Community 3 - "server/package.json"
Cohesion: 0.07
Nodes (35): dependencies, hono@^4.13.16, @hono/node-server@^2.1.6, jsdom@^30.1.3, @mozilla/readability@^0.6.0, web-push@3.6.7, zod@^4.6.7, devDependencies (+27 more)

### Community 4 - "rows.ts"
Cohesion: 0.07
Nodes (46): ENGLISH_DECK_ID, ENGLISH_SCHEMA, VUE_DECK_ID, deck, entry(), near(), NOW, vueDeck (+38 more)

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
Cohesion: 0.10
Nodes (21): BrandIcon, NAV_ITEMS, NavItem, router, EntrySource, capture, route, CaptureDetails (+13 more)

### Community 10 - "pnpm-workspace.yaml"
Cohesion: 0.29
Nodes (6): allowBuilds, esbuild, onnxruntime-node, protobufjs, sharp, packages

### Community 12 - "ImportDialog.vue"
Cohesion: 0.08
Nodes (35): VUE_SCHEMA, autoMapHeaders(), canImport(), guessDeck(), HEADER_ALIASES, HeaderMapping, normalizeHeader(), planImport() (+27 more)

### Community 13 - "DataSettings.vue"
Cohesion: 0.13
Nodes (18): Backup, backupProblem(), isObject(), canDelete, confirmDelete(), confirmRestore(), deleteOpen, deleteText (+10 more)

### Community 14 - "EntrySummary.vue"
Cohesion: 0.29
Nodes (5): { t }, library, props, summary, { t }

### Community 15 - "ai/enrichment.ts"
Cohesion: 0.08
Nodes (32): AiProvider, AiUsage, asEnum(), enrichEntries(), ENRICHMENT_SYSTEM_PROMPT, enrichmentOutputSchema(), EnrichmentResult, EnrichRequest (+24 more)

### Community 16 - "TodayPage.vue"
Cohesion: 0.12
Nodes (14): dexie@^4.4.7, EntryCounts, clock, decks, dueTomorrow, enrichment, failed, loading (+6 more)

### Community 17 - "QuickAddDialog.vue"
Cohesion: 0.18
Nodes (12): capture, closeCapturePopup(), library, openEntry(), { quickAddOpen }, router, save(), similar (+4 more)

### Community 18 - "dependencies"
Cohesion: 0.14
Nodes (14): dependencies, @fontsource-variable/inter@^5.3.0, @fontsource-variable/jetbrains-mono@^5.3.0, @huggingface/transformers@3.8.1, nanoid@^6.0.2, ts-fsrs@^6.0.0, vue@^3.5.44, vue-i18n@^11.4.18 (+6 more)

### Community 19 - "@playwright/test"
Cohesion: 0.15
Nodes (3): @axe-core/playwright@^4.14.0, @axe-core/playwright, @playwright/test

### Community 20 - "CommandPalette.vue"
Cohesion: 0.14
Nodes (13): activeIndex, capture, Command, commands, library, openLibraryDialog(), { paletteOpen }, query (+5 more)

### Community 21 - "DraftReview.vue"
Cohesion: 0.09
Nodes (42): escapeHtml(), HIDDEN_ON_CARD, renderField(), toAnkiText(), toCardHtml(), appendOwnExample(), confirmPatch(), DRAFT_FIELDS (+34 more)

### Community 22 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, preview, test, test:e2e, test:watch, typecheck

### Community 23 - "LibrarySources.vue"
Cohesion: 0.18
Nodes (19): cleanWebLink(), LibrarySource, librarySources(), linkedSource(), sourceDestination(), SourceKind, videoIdOfSource(), webSearchUrl() (+11 more)

### Community 24 - "TableCell.vue"
Cohesion: 0.16
Nodes (13): control(), display, draft, editing, fieldLabel, finish(), isMultiline, library (+5 more)

### Community 25 - "library.spec.ts"
Cohesion: 0.27
Nodes (5): download(), entries(), entry(), openImport(), openLibrary()

### Community 26 - "WrapUpRecap.vue"
Cohesion: 0.18
Nodes (9): AnswerResult, box, check(), index, questions, result, right, { t } (+1 more)

### Community 27 - "todayStore.ts"
Cohesion: 0.18
Nodes (16): studySessionRepository, DEFAULT_WEEKLY_TARGETS, INTENSITIES, Intensity, PATHS, planMinutes(), SESSION_PLANS, SessionPlanId (+8 more)

### Community 28 - "duplicates.test.ts"
Cohesion: 0.31
Nodes (10): areNearDuplicates(), editDistance(), ENRICHMENT_RANK, findDuplicatePairs(), mergeEntries(), pairKey(), stemKey(), stemToken() (+2 more)

### Community 29 - "StatsPage.vue"
Cohesion: 0.07
Nodes (54): accuracyBy(), AccuracyRow, activityCalendar(), addDays(), dayKey(), dueForecast(), EntryFacts, FocusSuggestion (+46 more)

### Community 30 - "TableView.vue"
Cohesion: 0.11
Nodes (15): ariaSort(), canScroll, { canScrollLeft, canScrollRight, panning, scrollByPage }, columns, fieldLabel, isPinned(), library, pinnedEdge (+7 more)

### Community 31 - "enrichmentQueue.test.ts"
Cohesion: 0.12
Nodes (15): ENRICH_BATCH_SIZE, Enrichment, EnrichRequest, EnrichResponse, ENTRY_PROBLEMS, PauseQueue, QueueDeps, QueueResult (+7 more)

### Community 32 - "OwnExampleCoach.vue"
Cohesion: 0.15
Nodes (16): feedbackTarget(), sameSentence(), SentenceFeedback, requestFeedback(), add(), ask(), asking, emit (+8 more)

### Community 33 - "fieldVisuals.ts"
Cohesion: 0.13
Nodes (24): hiddenCount, items, props, shownItems, sourceLabel, { t }, target, value (+16 more)

### Community 34 - "spreadsheet.test.ts"
Cohesion: 0.17
Nodes (18): parseCsv(), ParsedSheet, parseSpreadsheetFile(), parseXlsx(), readWorkbook(), safeSheetName(), SheetData, cases (+10 more)

### Community 35 - "enrichment.spec.ts"
Cohesion: 0.25
Nodes (14): aiOn(), draftItems(), FEEDBACK, hangAfterFirstBatch(), Item, itemsOf(), mockEnrichment(), mockSettings() (+6 more)

### Community 36 - "vue-i18n"
Cohesion: 0.24
Nodes (9): useFieldLabel(), expected, fieldLabel, otherFields, RESULT_COLORS, review, { t }, VERDICT_COLORS (+1 more)

### Community 37 - "KanbanView.vue"
Cohesion: 0.14
Nodes (12): columns, dropTarget, library, move(), onDrop(), statusField, { t }, color (+4 more)

### Community 39 - "AiSettings.vue"
Cohesion: 0.07
Nodes (39): AiModelOption, AiProviderId, AiSettingsView, fetchAiModels(), fetchAiSettings(), KNOWN_CODES, post(), resetAiSettings() (+31 more)

### Community 40 - "EnrichmentPage.vue"
Cohesion: 0.15
Nodes (10): canRetry, enrichment, isEmpty, library, route, selected, selectedDeck, selectedId (+2 more)

### Community 41 - "repositories.ts"
Cohesion: 0.15
Nodes (12): createV1Db(), freshDb(), open, pendingEntry(), setUp(), upgraded(), createDeckRepository(), createEntryRepository() (+4 more)

### Community 42 - "readingStore.ts"
Cohesion: 0.06
Nodes (51): findSentence(), readingParagraphs(), ReadingSentence, readingStats(), sentenceSegmenter, splitSentences(), deck, NOW (+43 more)

### Community 43 - "review.ts"
Cohesion: 0.20
Nodes (14): applyReview(), isCorrect(), LEECH_LAPSES, nextStatus(), ReviewAnswer, ReviewRating, scheduler, cardToSrs() (+6 more)

### Community 44 - "domain/types.ts"
Cohesion: 0.11
Nodes (29): createBackup(), deleteEverything(), LIST_FIELDS, restoreBackup(), freshDb(), open, db, LinguaForgeDb (+21 more)

### Community 45 - "Entry"
Cohesion: 0.15
Nodes (3): EntryRepository, ImportPlan, Entry

### Community 46 - "ReadingPage.vue"
Cohesion: 0.10
Nodes (17): coverage, enrichment, heading, link, linkError, onPointerUp(), openLink(), originalUrl (+9 more)

### Community 47 - "SourceLink.vue"
Cohesion: 0.25
Nodes (7): destination, isClip, isVideo, label, props, { t }, to

### Community 48 - "createApp"
Cohesion: 0.08
Nodes (30): ProviderId, AiSettingsInput, aiSettingsInputSchema, cleanBaseUrl(), createFileStore(), readAll(), update(), createLocalSettings() (+22 more)

### Community 49 - "createKokoroEngine"
Cohesion: 0.08
Nodes (36): kokoro-js@1.2.1, downloadVoices(), line, load(), reply(), speak(), VoiceName, Clip (+28 more)

### Community 50 - "reviewStore.ts"
Cohesion: 0.20
Nodes (19): ClozePart, suggestedRating(), buildQueue(), isLeech(), buildCard(), chooseMode(), clozeOptions(), examplesOf() (+11 more)

### Community 51 - "client.ts"
Cohesion: 0.10
Nodes (29): openai@^7.48.0, AiErrorCode, AiFailure, codeForStatus(), JsonRequest, parseJsonOutput(), STATUS_BY_CODE, statusFor() (+21 more)

### Community 52 - "voiceStore.ts"
Cohesion: 0.17
Nodes (19): accents, browserVoiceFound, naturalActive, percent, { t }, voice, englishVoices(), hasBrowserVoice() (+11 more)

### Community 53 - "PlayerFrame.vue"
Cohesion: 0.10
Nodes (13): createHtmlPlayer(), createYouTubePlayer(), loadYouTubeApi(), MediaPlayer, Window, YouTubeApi, failed, onFileReady() (+5 more)

### Community 54 - "review.test.ts"
Cohesion: 0.25
Nodes (10): checkAnswer(), editDistance(), makeCloze(), redactTarget(), sameWord(), stem(), wordsOf(), card() (+2 more)

### Community 55 - "reading.test.ts"
Cohesion: 0.19
Nodes (10): fetchOnce(), fetchPublicPage(), INTERNAL, isPublicAddress(), PageError, PageErrorCode, parsePageUrl(), publicOnlyLookup() (+2 more)

### Community 56 - "libraryStore.ts"
Cohesion: 0.11
Nodes (29): activeFilterCount(), allows(), DEFAULT_SORT, emptyFilters(), haystackOf(), haystacks, isDueToday(), matchesFilters() (+21 more)

### Community 57 - "ai/tutor.ts"
Cohesion: 0.14
Nodes (16): OUTPUT_SYSTEM_PROMPT, outputOutputSchema, OutputRequest, outputRequestSchema, OutputReview, reviewOutput(), runTutorTurn(), ScenarioId (+8 more)

### Community 58 - "tutorStore.ts"
Cohesion: 0.13
Nodes (20): StudySessionRepository, TutorRepository, urgency(), historyPayload(), pickTargets(), TARGET_COUNT, targetPayload(), card() (+12 more)

### Community 59 - "PriorityBars.vue"
Cohesion: 0.29
Nodes (6): BARS, color, COLORS, label, props, { t }

### Community 60 - "VideoPage.vue"
Cohesion: 0.17
Nodes (13): parseYouTubeId(), backToList(), heading, link, linkError, numberParam(), openLink(), recent (+5 more)

### Community 61 - "EntryEditor.vue"
Cohesion: 0.13
Nodes (14): safeHttpUrl(), cells, deck, entry, fieldLabel, ipa, library, notes (+6 more)

### Community 62 - "videoStore.ts"
Cohesion: 0.19
Nodes (17): cleanText(), cueIndexAt(), ENTITIES, formatTime(), parsePlain(), parseSubtitles(), parseTimed(), removeRollingRepeats() (+9 more)

### Community 63 - "TutorPage.vue"
Cohesion: 0.17
Nodes (12): TutorCorrection, AiUsage, enrichment, { t }, tab, TABS, tutor, OutputReview (+4 more)

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
Cohesion: 0.26
Nodes (8): answerAndGrade(), answerBox(), card(), modeOf(), noVoice(), openReview(), patchEntry(), toUseIt()

### Community 69 - "voice.spec.ts"
Cohesion: 0.20
Nodes (3): Failure, settings(), turnOnNaturalVoice()

### Community 70 - "notify"
Cohesion: 0.18
Nodes (15): deckRepository, add(), deck, deckId, fieldLabel, hasOption(), library, LOCKED_STATUSES (+7 more)

### Community 71 - "VideoRepository"
Cohesion: 0.29
Nodes (4): VideoRepository, MediaKey, Transcript, VideoSession

### Community 73 - "ReviewPage.vue"
Cohesion: 0.18
Nodes (9): answerInput, enrichment, isTypingCard, library, RATING_KEYS, RATINGS, review, { t } (+1 more)

### Community 74 - "ChatPanel.vue"
Cohesion: 0.20
Nodes (9): box, draft, list, mic, onKey(), send(), { t }, tutor (+1 more)

### Community 75 - "TranscriptPanel.vue"
Cohesion: 0.27
Nodes (10): captureWordAt(), cueIndexOf(), list, load(), onFile(), onWordKey(), onWordsPointerUp(), pasted (+2 more)

### Community 77 - "OutputTask.vue"
Cohesion: 0.13
Nodes (10): wordCount(), mic, { t }, text, tutor, words, Recognition, RecognitionClass (+2 more)

### Community 79 - "LibraryPage.vue"
Cohesion: 0.09
Nodes (19): lucide-vue-next@^1.0.0, reka-ui@^2.11.0, selected, allTags, FACETS, library, PRIORITIES, { t } (+11 more)

### Community 80 - "ActivityHeatmap.vue"
Cohesion: 0.17
Nodes (10): ActivityCell, activeDays, asDate(), hovered, LEVELS, props, scroller, { t } (+2 more)

### Community 82 - "enrichmentStore.ts"
Cohesion: 0.42
Nodes (8): canAutoEnrich(), needsManualText(), fetchAiConfigured(), requestEnrichment(), DEFAULT_DAILY_TOKENS, localDay(), useEnrichmentStore, withQueueLock()

### Community 84 - "CaptureCard.vue"
Cohesion: 0.29
Nodes (6): emit, props, { t }, text, Capture, VideoCapture

### Community 85 - "vite.config.ts"
Cohesion: 0.20
Nodes (8): @tailwindcss/vite@^4.3.4, vite@^8.3.5, vite-plugin-pwa@2.0.0, @vitejs/plugin-vue@^6.0.10, @tailwindcss/vite, vite, vite-plugin-pwa, @vitejs/plugin-vue

### Community 87 - "ForecastChart.vue"
Cohesion: 0.24
Nodes (9): ForecastDay, active, asDate(), hovered, max, props, shortDay(), { t } (+1 more)

### Community 88 - "web/package.json"
Cohesion: 0.18
Nodes (10): @types/node@^26.6.6, workbox-build@^7.4.1, workbox-window@^7.4.1, @types/node, name, private, type, version (+2 more)

### Community 89 - "reading.spec.ts"
Cohesion: 0.32
Nodes (5): ARTICLE, article(), mockArticle(), openArticle(), word()

### Community 90 - "stats.spec.ts"
Cohesion: 0.33
Nodes (3): answer(), daysAgo(), Seed

### Community 91 - "DuplicatesDialog.vue"
Cohesion: 0.18
Nodes (8): entryRepository, DuplicatePair, library, open, run(), { t }, open, { t }

### Community 94 - "FieldInput.vue"
Cohesion: 0.33
Nodes (5): options, PRIORITIES, props, value, isCodeField()

### Community 95 - "useToasts.ts"
Cohesion: 0.29
Nodes (7): bookmarklet, copy(), { t }, runAction(), dismissToast(), Toast, toasts

## Knowledge Gaps
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vue` connect `vue` to `AppShell.vue`, `ImportDialog.vue`, `DataSettings.vue`, `EntrySummary.vue`, `TodayPage.vue`, `QuickAddDialog.vue`, `dependencies`, `CommandPalette.vue`, `DraftReview.vue`, `LibrarySources.vue`, `TableCell.vue`, `WrapUpRecap.vue`, `todayStore.ts`, `StatsPage.vue`, `TableView.vue`, `OwnExampleCoach.vue`, `fieldVisuals.ts`, `vue-i18n`, `KanbanView.vue`, `AiSettings.vue`, `EnrichmentPage.vue`, `readingStore.ts`, `domain/types.ts`, `ReadingPage.vue`, `SourceLink.vue`, `reviewStore.ts`, `voiceStore.ts`, `PlayerFrame.vue`, `libraryStore.ts`, `tutorStore.ts`, `PriorityBars.vue`, `VideoPage.vue`, `EntryEditor.vue`, `videoStore.ts`, `TutorPage.vue`, `notify`, `BarList.vue`, `ReviewPage.vue`, `ChatPanel.vue`, `TranscriptPanel.vue`, `OutputTask.vue`, `LibraryPage.vue`, `ActivityHeatmap.vue`, `enrichmentStore.ts`, `CaptureCard.vue`, `ForecastChart.vue`, `web/package.json`, `DuplicatesDialog.vue`, `FieldInput.vue`, `useToasts.ts`?**
  _High betweenness centrality (0.118) - this node is a cross-community bridge._
- **Should `vue` be split into smaller, more focused modules?**
  _Cohesion score 0.09388335704125178 - nodes in this community are weakly interconnected._
- **Why does `useReadingStore` connect `readingStore.ts` to `notify`, `ReadingPage.vue`, `ai/enrichment.ts`, `enrichmentStore.ts`, `videoStore.ts`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Should `reminders.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0907258064516129 - nodes in this community are weakly interconnected._
- **Why does `estimateLevel()` connect `ai/enrichment.ts` to `readingStore.ts`, `client.ts`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Should `server/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.07301587301587302 - nodes in this community are weakly interconnected._
- **Should `rows.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07012987012987013 - nodes in this community are weakly interconnected._