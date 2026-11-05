# Graph Report - own-english-app  (2026-11-04)

## Corpus Check
- 167 files · ~94,011 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: .example 1, (none) 1, .css 1)

## Summary
- 1521 nodes · 3617 edges · 87 communities (84 shown, 3 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 55 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e4fc8686`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- SettingsPage.vue
- tutorStore.ts
- web/package.json
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
- ExportDialog.vue
- lucide-vue-next
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
- CapturePage.vue
- FilterBar.vue
- duplicates.test.ts
- FieldInput.vue
- TableView.vue
- enrichmentQueue.ts
- OwnExampleCoach.vue
- fieldVisuals.ts
- enrichment.test.ts
- enrichment.spec.ts
- Entry
- KanbanView.vue
- Deck
- AiSettings.vue
- EnrichmentPage.vue
- deckPresets.ts
- readingStore.ts
- review.test.ts
- domain/types.ts
- PriorityBars.vue
- LibrarySources.vue
- useTableScroll
- createApp
- createKokoroEngine
- reviewStore.ts
- client.ts
- voiceStore.ts
- PlayerFrame.vue
- spreadsheet.test.ts
- reading.test.ts
- libraryStore.ts
- ai/tutor.ts
- OutputTask.vue
- repositories.ts
- VideoPage.vue
- EntryEditor.vue
- videoStore.ts
- tutor/types.ts
- app.ts
- tutor.spec.ts
- video.spec.ts
- app.test.ts
- review.spec.ts
- voice.spec.ts
- DuplicatesDialog.vue
- VideoRepository
- vue-i18n
- ReviewPage.vue
- ChatPanel.vue
- TranscriptPanel.vue
- i18n.ts
- domain/enrichment.ts
- ExportDialog.vue
- LibraryPage.vue
- MediaPlayer
- tryEnrich.ts
- subtitles.ts
- TutorPage.vue
- StatusBadge.vue
- CaptureCard.vue

## God Nodes (most connected - your core abstractions)
1. `vue` - 60 edges
2. `Entry` - 60 edges
3. `notify()` - 56 edges
4. `vue-i18n` - 46 edges
5. `Deck` - 36 edges
6. `useLibraryStore` - 34 edges
7. `EntryRepository` - 30 edges
8. `createApp()` - 28 edges
9. `useEnrichmentStore` - 27 edges
10. `lucide-vue-next` - 25 edges

## Surprising Connections (you probably didn't know these)
- `Secrets and users` --references--> `AiSettingsStore`  [INFERRED]
  README.md → apps/server/src/ai/settings.ts
- `Secrets and users` --references--> `resolveUserId()`  [INFERRED]
  README.md → apps/server/src/auth.ts
- `useVoiceStore` --indirect_call--> `download()`  [INFERRED]
  apps/web/src/features/voice/voiceStore.ts → apps/web/e2e/library.spec.ts
- `useReadingStore` --indirect_call--> `estimateLevel()`  [INFERRED]
  apps/web/src/features/reading/readingStore.ts → apps/server/src/ai/level.ts
- `card()` --calls--> `createEntry()`  [EXTRACTED]
  apps/web/src/domain/review.test.ts → apps/web/src/domain/rows.ts

## Import Cycles
- None detected.

## Communities (87 total, 3 thin omitted)

### Community 0 - "SettingsPage.vue"
Cohesion: 0.19
Nodes (10): locale, mode, ThemeMode, useTheme(), locales, { mode }, review, reviewLimit (+2 more)

### Community 1 - "tutorStore.ts"
Cohesion: 0.26
Nodes (10): TutorRepository, urgency(), historyPayload(), pickTargets(), TARGET_COUNT, targetPayload(), usedTargetsOf(), TutorConversation (+2 more)

### Community 2 - "web/package.json"
Cohesion: 0.11
Nodes (24): devDependencies, fake-indexeddb@^6.2.7, @playwright/test@^1.64.1, tailwindcss@^4.3.4, @tailwindcss/vite@^4.3.4, @types/node@^26.6.6, typescript@^6.0.3, vite@^8.3.5 (+16 more)

### Community 3 - "server/package.json"
Cohesion: 0.07
Nodes (35): dependencies, hono@^4.13.16, @hono/node-server@^2.1.6, jsdom@^30.1.3, @mozilla/readability@^0.6.0, zod@^4.6.7, devDependencies, tsx@^4.23.15 (+27 more)

### Community 4 - "rows.ts"
Cohesion: 0.12
Nodes (27): planImport(), applyRowToEntry(), cellToPatch(), editPatch(), isListTarget(), isUnfilled(), LIST_TARGETS, ListTarget (+19 more)

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
Cohesion: 0.12
Nodes (15): AI enrichment, AI Tutor, Capturing from other sites, Commands, LinguaForge, Project layout, Reading Lab, Requirements (+7 more)

### Community 9 - "AppShell.vue"
Cohesion: 0.14
Nodes (15): vue-router@^5.4.0, BrandIcon, NAV_ITEMS, NavItem, placeholder(), capture, enrichment, isMac (+7 more)

### Community 10 - "pnpm-workspace.yaml"
Cohesion: 0.29
Nodes (6): allowBuilds, esbuild, onnxruntime-node, protobufjs, sharp, packages

### Community 12 - "ImportDialog.vue"
Cohesion: 0.08
Nodes (34): autoMapHeaders(), canImport(), guessDeck(), HEADER_ALIASES, HeaderMapping, normalizeHeader(), remapRows(), deck (+26 more)

### Community 13 - "ExportDialog.vue"
Cohesion: 0.06
Nodes (49): Backup, backupProblem(), createBackup(), deleteEverything(), isObject(), LIST_FIELDS, restoreBackup(), freshDb() (+41 more)

### Community 14 - "lucide-vue-next"
Cohesion: 0.18
Nodes (7): { t }, library, props, summary, { t }, selected, lucide-vue-next

### Community 15 - "ai/enrichment.ts"
Cohesion: 0.10
Nodes (22): AiProvider, AiUsage, asEnum(), enrichEntries(), ENRICHMENT_SYSTEM_PROMPT, enrichmentOutputSchema(), EnrichmentResult, EnrichRequest (+14 more)

### Community 16 - "TodayPage.vue"
Cohesion: 0.11
Nodes (20): nanoid@^6.0.2, EntryCounts, studySessionRepository, clock, decks, dueTomorrow, enrichment, failed (+12 more)

### Community 17 - "QuickAddDialog.vue"
Cohesion: 0.20
Nodes (11): capture, closeCapturePopup(), library, openEntry(), { quickAddOpen }, router, save(), similar (+3 more)

### Community 18 - "dependencies"
Cohesion: 0.10
Nodes (20): dependencies, dexie@^4.4.7, @fontsource-variable/inter@^5.3.0, @fontsource-variable/jetbrains-mono@^5.3.0, @huggingface/transformers@3.8.1, kokoro-js@1.2.1, lucide-vue-next@^1.0.0, reka-ui@^2.11.0 (+12 more)

### Community 19 - "@playwright/test"
Cohesion: 0.15
Nodes (8): ARTICLE, article(), mockArticle(), openArticle(), word(), @axe-core/playwright@^4.14.0, @axe-core/playwright, @playwright/test

### Community 20 - "CommandPalette.vue"
Cohesion: 0.15
Nodes (12): activeIndex, capture, Command, commands, library, openLibraryDialog(), { paletteOpen }, query (+4 more)

### Community 21 - "DraftReview.vue"
Cohesion: 0.13
Nodes (15): appendOwnExample(), addOwnExample(), cells, confirm(), emit, enrichment, fieldLabel, ipa (+7 more)

### Community 22 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, preview, test, test:e2e, test:watch, typecheck

### Community 23 - "enrichmentApi.ts"
Cohesion: 0.16
Nodes (16): EnrichmentDraft, SentenceFeedback, AiModelOption, AiProviderId, AiSettingsView, EnrichRequest, EnrichResponse, fetchAiModels() (+8 more)

### Community 24 - "TableCell.vue"
Cohesion: 0.16
Nodes (13): control(), display, draft, editing, fieldLabel, finish(), isMultiline, library (+5 more)

### Community 25 - "library.spec.ts"
Cohesion: 0.31
Nodes (5): download(), entries(), entry(), openImport(), openLibrary()

### Community 26 - "CapturePage.vue"
Cohesion: 0.22
Nodes (8): pinia@^4.1.0, EntrySource, LibrarySource, capture, route, CaptureDetails, useCaptureStore, pinia

### Community 27 - "FilterBar.vue"
Cohesion: 0.22
Nodes (7): CoreField, allTags, FACETS, library, PRIORITIES, { t }, viewName

### Community 28 - "duplicates.test.ts"
Cohesion: 0.33
Nodes (9): areNearDuplicates(), editDistance(), ENRICHMENT_RANK, findDuplicatePairs(), mergeEntries(), stemKey(), stemToken(), typoLimit() (+1 more)

### Community 29 - "FieldInput.vue"
Cohesion: 0.33
Nodes (5): options, PRIORITIES, props, value, isCodeField()

### Community 30 - "TableView.vue"
Cohesion: 0.14
Nodes (14): ariaSort(), canScroll, { canScrollLeft, canScrollRight, panning, scrollByPage }, columns, fieldLabel, isPinned(), library, pinnedEdge (+6 more)

### Community 31 - "enrichmentQueue.ts"
Cohesion: 0.20
Nodes (12): canAutoEnrich(), needsManualText(), Enrichment, fetchAiConfigured(), ENTRY_PROBLEMS, QueueDeps, QueueResult, runEnrichmentQueue() (+4 more)

### Community 32 - "OwnExampleCoach.vue"
Cohesion: 0.16
Nodes (14): feedbackTarget(), sameSentence(), add(), ask(), asking, emit, enrichment, hasSentence (+6 more)

### Community 33 - "fieldVisuals.ts"
Cohesion: 0.11
Nodes (27): CONTEXTS, ENTRY_KINDS, TONES, hiddenCount, items, props, shownItems, sourceLabel (+19 more)

### Community 34 - "enrichment.test.ts"
Cohesion: 0.15
Nodes (22): escapeHtml(), HIDDEN_ON_CARD, renderField(), toAnkiText(), toCardHtml(), confirmPatch(), draftCell(), initialCells() (+14 more)

### Community 35 - "enrichment.spec.ts"
Cohesion: 0.25
Nodes (14): aiOn(), draftItems(), FEEDBACK, hangAfterFirstBatch(), Item, itemsOf(), mockEnrichment(), mockSettings() (+6 more)

### Community 36 - "Entry"
Cohesion: 0.13
Nodes (6): EntryRepository, ImportPlan, ReviewAnswer, Entry, ReviewLog, ReviewMode

### Community 37 - "KanbanView.vue"
Cohesion: 0.25
Nodes (7): columns, dropTarget, library, move(), onDrop(), statusField, { t }

### Community 38 - "Deck"
Cohesion: 0.11
Nodes (20): ENGLISH_SCHEMA, deck, NOW, createEntry(), card(), deck, later(), NOW (+12 more)

### Community 39 - "AiSettings.vue"
Cohesion: 0.08
Nodes (29): requestEnrichment(), resetAiSettings(), apiKey, applySaved(), baseUrl, budgetInput, busy, canSave (+21 more)

### Community 40 - "EnrichmentPage.vue"
Cohesion: 0.15
Nodes (10): canRetry, enrichment, isEmpty, library, route, selected, selectedDeck, selectedId (+2 more)

### Community 41 - "deckPresets.ts"
Cohesion: 0.13
Nodes (21): createV1Db(), freshDb(), open, pendingEntry(), setUp(), upgraded(), DECK_PRESETS, ENGLISH_DECK_ID (+13 more)

### Community 42 - "readingStore.ts"
Cohesion: 0.06
Nodes (50): wordsOf(), findSentence(), readingParagraphs(), ReadingSentence, readingStats(), sentenceSegmenter, splitSentences(), textSample() (+42 more)

### Community 43 - "review.test.ts"
Cohesion: 0.15
Nodes (17): createEntryRepository(), pairKey(), applyReview(), isCorrect(), LEECH_LAPSES, nextStatus(), ReviewRating, scheduler (+9 more)

### Community 44 - "domain/types.ts"
Cohesion: 0.18
Nodes (10): SavedViewRepository, LibraryFilters, SortKey, EntryKind, FieldDef, FieldType, IsoDate, LEARNING_STATUSES (+2 more)

### Community 45 - "PriorityBars.vue"
Cohesion: 0.29
Nodes (6): BARS, color, COLORS, label, props, { t }

### Community 46 - "LibrarySources.vue"
Cohesion: 0.06
Nodes (42): cleanWebLink(), librarySources(), linkedSource(), sourceDestination(), SourceKind, videoIdOfSource(), webSearchUrl(), youTubeSearchUrl() (+34 more)

### Community 47 - "useTableScroll"
Cohesion: 0.25
Nodes (4): @vueuse/core@^15.0.0, useTableScroll(), vue, @vueuse/core

### Community 48 - "createApp"
Cohesion: 0.08
Nodes (36): anthropicProvider(), createProvider(), ProviderId, AiSettingsInput, aiSettingsInputSchema, cleanBaseUrl(), createFileStore(), readAll() (+28 more)

### Community 49 - "createKokoroEngine"
Cohesion: 0.08
Nodes (33): downloadVoices(), line, load(), reply(), speak(), VoiceName, Clip, createKokoroEngine() (+25 more)

### Community 50 - "reviewStore.ts"
Cohesion: 0.16
Nodes (26): AnswerResult, checkAnswer(), ClozePart, editDistance(), makeCloze(), redactTarget(), sameWord(), stem() (+18 more)

### Community 51 - "client.ts"
Cohesion: 0.13
Nodes (19): openai@^7.48.0, AiErrorCode, AiFailure, codeForStatus(), JsonRequest, parseJsonOutput(), STATUS_BY_CODE, statusFor() (+11 more)

### Community 52 - "voiceStore.ts"
Cohesion: 0.16
Nodes (20): accents, browserVoiceFound, naturalActive, percent, { t }, voice, englishVoices(), hasBrowserVoice() (+12 more)

### Community 53 - "PlayerFrame.vue"
Cohesion: 0.10
Nodes (13): createHtmlPlayer(), createYouTubePlayer(), loadYouTubeApi(), Window, YouTubeApi, YouTubePlayer, failed, onFileReady() (+5 more)

### Community 54 - "spreadsheet.test.ts"
Cohesion: 0.17
Nodes (18): parseCsv(), ParsedSheet, parseSpreadsheetFile(), parseXlsx(), readWorkbook(), safeSheetName(), SheetData, cases (+10 more)

### Community 55 - "reading.test.ts"
Cohesion: 0.19
Nodes (10): fetchOnce(), fetchPublicPage(), INTERNAL, isPublicAddress(), PageError, PageErrorCode, parsePageUrl(), publicOnlyLookup() (+2 more)

### Community 56 - "libraryStore.ts"
Cohesion: 0.22
Nodes (16): activeFilterCount(), allows(), emptyFilters(), haystackOf(), haystacks, isDueToday(), matchesFilters(), sortEntries() (+8 more)

### Community 57 - "ai/tutor.ts"
Cohesion: 0.14
Nodes (16): OUTPUT_SYSTEM_PROMPT, outputOutputSchema, OutputRequest, outputRequestSchema, OutputReview, reviewOutput(), runTutorTurn(), ScenarioId (+8 more)

### Community 58 - "OutputTask.vue"
Cohesion: 0.13
Nodes (10): wordCount(), mic, { t }, text, tutor, words, Recognition, RecognitionClass (+2 more)

### Community 59 - "repositories.ts"
Cohesion: 0.13
Nodes (6): createDeckRepository(), DeckRepository, savedViewRepository, StudySessionRepository, tutorRepository, StudySession

### Community 60 - "VideoPage.vue"
Cohesion: 0.16
Nodes (14): videoRepository, parseYouTubeId(), backToList(), heading, link, linkError, numberParam(), openLink() (+6 more)

### Community 61 - "EntryEditor.vue"
Cohesion: 0.13
Nodes (14): safeHttpUrl(), cells, deck, entry, fieldLabel, ipa, library, notes (+6 more)

### Community 62 - "videoStore.ts"
Cohesion: 0.20
Nodes (12): cueIndexAt(), formatTime(), Cue, Capture, saveCapture(), MODES, RATES, { t } (+4 more)

### Community 63 - "tutor/types.ts"
Cohesion: 0.23
Nodes (11): TutorCorrection, AiRequestError, AiUsage, post(), requestOutputReview(), requestTutorTurn(), Target, OutputReview (+3 more)

### Community 64 - "app.ts"
Cohesion: 0.21
Nodes (7): AiSettingsStore, SecretBox, AppOptions, LOCAL_HOSTS, resolveUserId(), FetchedPage, Secrets and users

### Community 65 - "tutor.spec.ts"
Cohesion: 0.20
Nodes (7): CORRECTED, entryNamed(), mockTutor(), OPENING, openTask(), stored(), USAGE

### Community 66 - "video.spec.ts"
Cohesion: 0.18
Nodes (4): cue(), FakeYt, TRANSCRIPT, word()

### Community 67 - "app.test.ts"
Cohesion: 0.18
Nodes (6): @anthropic-ai/sdk@^1.4.0, ENV, ITEMS, NOTE, OPTIONS, @anthropic-ai/sdk

### Community 68 - "review.spec.ts"
Cohesion: 0.27
Nodes (7): answerAndGrade(), answerBox(), card(), modeOf(), openReview(), patchEntry(), toUseIt()

### Community 69 - "voice.spec.ts"
Cohesion: 0.20
Nodes (3): Failure, settings(), turnOnNaturalVoice()

### Community 70 - "DuplicatesDialog.vue"
Cohesion: 0.18
Nodes (8): entryRepository, DuplicatePair, library, open, run(), { t }, open, { t }

### Community 71 - "VideoRepository"
Cohesion: 0.29
Nodes (4): VideoRepository, MediaKey, Transcript, VideoSession

### Community 72 - "vue-i18n"
Cohesion: 0.24
Nodes (9): useFieldLabel(), expected, fieldLabel, otherFields, RESULT_COLORS, review, { t }, VERDICT_COLORS (+1 more)

### Community 73 - "ReviewPage.vue"
Cohesion: 0.18
Nodes (9): answerInput, enrichment, isTypingCard, library, RATING_KEYS, RATINGS, review, { t } (+1 more)

### Community 74 - "ChatPanel.vue"
Cohesion: 0.20
Nodes (9): box, draft, list, mic, onKey(), send(), { t }, tutor (+1 more)

### Community 75 - "TranscriptPanel.vue"
Cohesion: 0.27
Nodes (10): captureWordAt(), cueIndexOf(), list, load(), onFile(), onWordKey(), onWordsPointerUp(), pasted (+2 more)

### Community 76 - "i18n.ts"
Cohesion: 0.31
Nodes (5): i18n, Locale, en, es, router

### Community 77 - "domain/enrichment.ts"
Cohesion: 0.22
Nodes (8): DRAFT_FIELDS, DraftField, ENRICH_BATCH_SIZE, enrichmentRequest(), optionsOf(), ReviewedValues, PauseQueue, process()

### Community 78 - "ExportDialog.vue"
Cohesion: 0.22
Nodes (9): DEFAULT_SORT, deck, exporters, library, open, run(), sheetFor(), sortedEntries() (+1 more)

### Community 79 - "LibraryPage.vue"
Cohesion: 0.22
Nodes (8): duplicateCount, enrichment, fieldLabel, library, { t }, VIEW_COMPONENTS, VIEWS, LibraryView

### Community 81 - "tryEnrich.ts"
Cohesion: 0.29
Nodes (6): ProviderConfig, LOCAL_USER_ID, CONTEXTS, KINDS, texts, TONES

### Community 82 - "subtitles.ts"
Cohesion: 0.50
Nodes (7): cleanText(), ENTITIES, parsePlain(), parseSubtitles(), parseTimed(), removeRollingRepeats(), seconds()

### Community 83 - "TutorPage.vue"
Cohesion: 0.29
Nodes (6): enrichment, { t }, tab, TABS, tutor, SCENARIO_IDS

### Community 84 - "StatusBadge.vue"
Cohesion: 0.33
Nodes (5): color, dash, props, stage, STAGES

### Community 85 - "CaptureCard.vue"
Cohesion: 0.40
Nodes (4): emit, props, { t }, text

## Knowledge Gaps
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vue` connect `useTableScroll` to `SettingsPage.vue`, `tutorStore.ts`, `web/package.json`, `AppShell.vue`, `ImportDialog.vue`, `ExportDialog.vue`, `lucide-vue-next`, `TodayPage.vue`, `QuickAddDialog.vue`, `dependencies`, `CommandPalette.vue`, `DraftReview.vue`, `TableCell.vue`, `CapturePage.vue`, `FilterBar.vue`, `FieldInput.vue`, `TableView.vue`, `enrichmentQueue.ts`, `OwnExampleCoach.vue`, `fieldVisuals.ts`, `KanbanView.vue`, `AiSettings.vue`, `EnrichmentPage.vue`, `readingStore.ts`, `PriorityBars.vue`, `LibrarySources.vue`, `reviewStore.ts`, `voiceStore.ts`, `PlayerFrame.vue`, `libraryStore.ts`, `OutputTask.vue`, `VideoPage.vue`, `EntryEditor.vue`, `videoStore.ts`, `DuplicatesDialog.vue`, `vue-i18n`, `ReviewPage.vue`, `ChatPanel.vue`, `TranscriptPanel.vue`, `i18n.ts`, `ExportDialog.vue`, `LibraryPage.vue`, `TutorPage.vue`, `StatusBadge.vue`, `CaptureCard.vue`?**
  _High betweenness centrality (0.120) - this node is a cross-community bridge._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.10541310541310542 - nodes in this community are weakly interconnected._
- **Why does `useReadingStore` connect `readingStore.ts` to `ExportDialog.vue`, `LibrarySources.vue`, `ai/enrichment.ts`, `videoStore.ts`, `enrichmentQueue.ts`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Should `server/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.07057057057057058 - nodes in this community are weakly interconnected._
- **Why does `estimateLevel()` connect `ai/enrichment.ts` to `app.ts`, `createApp`, `readingStore.ts`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Should `rows.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11693548387096774 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._