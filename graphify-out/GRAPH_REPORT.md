# Graph Report - own-english-app  (2026-11-04)

## Corpus Check
- 99 files · ~44,858 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: .example 1, (none) 1, .css 1)

## Summary
- 851 nodes · 1973 edges · 48 communities (45 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 21 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- SettingsPage.vue
- types.ts
- web/package.json
- server/package.json
- libraryStore.ts
- compilerOptions
- scripts
- compilerOptions
- LinguaForge
- AppShell.vue
- pnpm-workspace.yaml
- CLAUDE.md
- ImportDialog.vue
- ExportDialog.vue
- vue-i18n
- app.ts
- repositories.ts
- QuickAddDialog.vue
- dependencies
- @playwright/test
- CommandPalette.vue
- DraftReview.vue
- scripts
- enrichmentQueue.test.ts
- TableCell.vue
- library.spec.ts
- CapturePage.vue
- FilterBar.vue
- duplicates.test.ts
- CellDisplay.vue
- TableView.vue
- enrichmentQueue.ts
- OwnExampleCoach.vue
- fieldVisuals.ts
- enrichment.test.ts
- enrichment.spec.ts
- Entry
- KanbanView.vue
- db.ts
- enrichmentStore.ts
- EnrichmentPage.vue
- db.test.ts
- backup.test.ts
- srs.ts
- SavedView
- PriorityBars.vue
- scripts
- useTableScroll

## God Nodes (most connected - your core abstractions)
1. `Entry` - 41 edges
2. `vue` - 36 edges
3. `notify()` - 34 edges
4. `vue-i18n` - 31 edges
5. `useLibraryStore` - 30 edges
6. `Deck` - 25 edges
7. `cellOf()` - 22 edges
8. `EntryRepository` - 20 edges
9. `useEnrichmentStore` - 19 edges
10. `normalizeText()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `value` --calls--> `cellOf()`  [EXTRACTED]
  apps/web/src/features/library/CellDisplay.vue → apps/web/src/domain/rows.ts
- `display` --calls--> `cellOf()`  [EXTRACTED]
  apps/web/src/features/library/TableCell.vue → apps/web/src/domain/rows.ts
- `ImportPlan` --references--> `Entry`  [EXTRACTED]
  apps/web/src/domain/importer.ts → apps/web/src/domain/types.ts
- `useEnrichmentStore` --indirect_call--> `requestEnrichment()`  [INFERRED]
  apps/web/src/features/enrichment/enrichmentStore.ts → apps/web/src/features/enrichment/enrichmentApi.ts
- `useEnrichmentStore` --indirect_call--> `start()`  [INFERRED]
  apps/web/src/features/enrichment/enrichmentStore.ts → apps/web/src/features/library/TableCell.vue

## Import Cycles
- None detected.

## Communities (48 total, 3 thin omitted)

### Community 0 - "SettingsPage.vue"
Cohesion: 0.14
Nodes (15): @vueuse/core@^15.0.0, i18n, Locale, locale, en, es, router, mode (+7 more)

### Community 1 - "types.ts"
Cohesion: 0.20
Nodes (12): CONTEXTS, ENTRY_KINDS, EntryKind, EntryStats, FieldType, IMPORTANCE_LEVELS, IsoDate, LEARNING_STATUSES (+4 more)

### Community 2 - "web/package.json"
Cohesion: 0.14
Nodes (17): devDependencies, fake-indexeddb@^6.2.7, tailwindcss@^4.3.4, @tailwindcss/vite@^4.3.4, vite@^8.3.5, @vitejs/plugin-vue@^6.0.10, vue-tsc@^3.3.14, name (+9 more)

### Community 3 - "server/package.json"
Cohesion: 0.15
Nodes (16): devDependencies, tsx@^4.23.15, @types/node@^26.6.6, typescript@^6.0.3, vitest@^5.1.0, name, private, type (+8 more)

### Community 4 - "libraryStore.ts"
Cohesion: 0.05
Nodes (70): toSheet(), escapeHtml(), HIDDEN_ON_CARD, renderField(), toAnkiText(), toCardHtml(), activeFilterCount(), allows() (+62 more)

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
Cohesion: 0.17
Nodes (11): AI enrichment, Capturing from other sites, Commands, LinguaForge, Project layout, Requirements, Roadmap, Run it (+3 more)

### Community 9 - "AppShell.vue"
Cohesion: 0.15
Nodes (14): BrandIcon, NAV_ITEMS, NavItem, placeholder(), capture, enrichment, isMac, mobileTabs (+6 more)

### Community 10 - "pnpm-workspace.yaml"
Cohesion: 0.50
Nodes (3): allowBuilds, esbuild, packages

### Community 12 - "ImportDialog.vue"
Cohesion: 0.06
Nodes (52): parseCsv(), ParsedSheet, parseSpreadsheetFile(), parseXlsx(), readWorkbook(), safeSheetName(), SheetData, cases (+44 more)

### Community 13 - "ExportDialog.vue"
Cohesion: 0.05
Nodes (51): createBackup(), deleteEverything(), restoreBackup(), DuplicatePair, library, open, run(), { t } (+43 more)

### Community 14 - "vue-i18n"
Cohesion: 0.11
Nodes (17): { t }, library, props, summary, { t }, duplicateCount, enrichment, fieldLabel (+9 more)

### Community 15 - "app.ts"
Cohesion: 0.06
Nodes (49): dependencies, @anthropic-ai/sdk@^1.4.0, hono@^4.13.16, @hono/node-server@^2.1.6, zod@^4.6.7, AiClient, AiErrorCode, AiFailure (+41 more)

### Community 16 - "repositories.ts"
Cohesion: 0.15
Nodes (11): DeckRepository, deckRepository, EntryCounts, entryRepository, savedViewRepository, decks, enrichment, failed (+3 more)

### Community 17 - "QuickAddDialog.vue"
Cohesion: 0.18
Nodes (12): pinia@^4.1.0, capture, closeCapturePopup(), library, openEntry(), { quickAddOpen }, router, save() (+4 more)

### Community 18 - "dependencies"
Cohesion: 0.18
Nodes (11): dependencies, @fontsource-variable/inter@^5.3.0, @fontsource-variable/jetbrains-mono@^5.3.0, lucide-vue-next@^1.0.0, vue@^3.5.44, vue-i18n@^11.4.18, vue-router@^5.4.0, xlsx@https://cdn.sheetjs.com/xlsx-0.20.3/x... (+3 more)

### Community 19 - "@playwright/test"
Cohesion: 0.25
Nodes (4): @axe-core/playwright@^4.14.0, @playwright/test@^1.64.1, @axe-core/playwright, @playwright/test

### Community 20 - "CommandPalette.vue"
Cohesion: 0.15
Nodes (12): activeIndex, capture, Command, commands, library, openLibraryDialog(), { paletteOpen }, query (+4 more)

### Community 21 - "DraftReview.vue"
Cohesion: 0.11
Nodes (25): appendOwnExample(), confirmPatch(), DRAFT_FIELDS, draftCell(), DraftField, initialCells(), isDraftField(), isUserValue() (+17 more)

### Community 22 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, preview, test, test:e2e, test:watch, typecheck

### Community 23 - "enrichmentQueue.test.ts"
Cohesion: 0.16
Nodes (13): VUE_SCHEMA, EnrichmentDraft, AiRequestError, EnrichRequest, EnrichResponse, KNOWN_CODES, post(), requestEnrichment() (+5 more)

### Community 24 - "TableCell.vue"
Cohesion: 0.15
Nodes (15): FieldDef, control(), display, draft, editing, fieldLabel, finish(), isMultiline (+7 more)

### Community 25 - "library.spec.ts"
Cohesion: 0.27
Nodes (4): entries(), entry(), openImport(), openLibrary()

### Community 26 - "CapturePage.vue"
Cohesion: 0.31
Nodes (6): EntrySource, capture, route, CaptureDetails, useCaptureStore, vue

### Community 27 - "FilterBar.vue"
Cohesion: 0.15
Nodes (9): reka-ui@^2.11.0, CoreField, selected, allTags, library, PRIORITIES, { t }, viewName (+1 more)

### Community 28 - "duplicates.test.ts"
Cohesion: 0.19
Nodes (16): VUE_DECK_ID, areNearDuplicates(), editDistance(), ENRICHMENT_RANK, findDuplicatePairs(), mergeEntries(), pairKey(), stemKey() (+8 more)

### Community 29 - "CellDisplay.vue"
Cohesion: 0.12
Nodes (15): hiddenCount, items, props, shownItems, sourceLabel, { t }, target, value (+7 more)

### Community 30 - "TableView.vue"
Cohesion: 0.14
Nodes (14): ariaSort(), canScroll, { canScrollLeft, canScrollRight, panning, scrollByPage }, columns, fieldLabel, isPinned(), library, pinnedEdge (+6 more)

### Community 31 - "enrichmentQueue.ts"
Cohesion: 0.19
Nodes (10): ENRICH_BATCH_SIZE, enrichmentRequest(), optionsOf(), Enrichment, ENTRY_PROBLEMS, PauseQueue, QueueDeps, QueueResult (+2 more)

### Community 32 - "OwnExampleCoach.vue"
Cohesion: 0.15
Nodes (15): feedbackTarget(), sameSentence(), SentenceFeedback, add(), ask(), asking, emit, enrichment (+7 more)

### Community 33 - "fieldVisuals.ts"
Cohesion: 0.23
Nodes (14): BADGE_COLORS, BadgeColor, CODE_FIELDS, colorFor(), CONTEXT_ICONS, FIELD_ICONS, IMPORTANCE_VISUALS, importanceVisual() (+6 more)

### Community 34 - "enrichment.test.ts"
Cohesion: 0.17
Nodes (14): entry(), deck, DRAFT, draftEntry(), NOW, vueDeck, createEntry(), fieldOf() (+6 more)

### Community 35 - "enrichment.spec.ts"
Cohesion: 0.24
Nodes (12): aiOn(), draftItems(), FEEDBACK, Item, itemsOf(), mockEnrichment(), noteFor(), openDraftFor() (+4 more)

### Community 37 - "KanbanView.vue"
Cohesion: 0.15
Nodes (11): columns, dropTarget, library, move(), onDrop(), { t }, color, dash (+3 more)

### Community 38 - "db.ts"
Cohesion: 0.28
Nodes (11): Backup, LIST_FIELDS, db, LinguaForgeDb, DECK_PRESETS, Deck, Mistake, ReviewLog (+3 more)

### Community 39 - "enrichmentStore.ts"
Cohesion: 0.26
Nodes (10): canAutoEnrich(), needsManualText(), AiUsage, fetchAiConfigured(), DEFAULT_DAILY_TOKENS, localDay(), useEnrichmentStore, withQueueLock() (+2 more)

### Community 40 - "EnrichmentPage.vue"
Cohesion: 0.15
Nodes (10): canRetry, enrichment, isEmpty, library, route, selected, selectedDeck, selectedId (+2 more)

### Community 41 - "db.test.ts"
Cohesion: 0.25
Nodes (9): dexie@^4.4.7, createV1Db(), freshDb(), open, pendingEntry(), upgraded(), createDeckRepository(), createEntryRepository() (+1 more)

### Community 42 - "backup.test.ts"
Cohesion: 0.20
Nodes (8): nanoid@^6.0.2, backupProblem(), isObject(), freshDb(), open, ENGLISH_DECK_ID, onFile(), nanoid

### Community 43 - "srs.ts"
Cohesion: 0.33
Nodes (6): ts-fsrs@^6.0.0, cardToSrs(), newSrsState(), srsToCard(), SrsState, ts-fsrs

### Community 44 - "SavedView"
Cohesion: 0.33
Nodes (4): SavedViewRepository, LibraryFilters, SortKey, SavedView

### Community 45 - "PriorityBars.vue"
Cohesion: 0.29
Nodes (6): BARS, color, COLORS, label, props, { t }

### Community 46 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, enrich:try, test, typecheck

## Knowledge Gaps
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `server/package.json` to `fieldVisuals.ts`, `web/package.json`, `enrichment.test.ts`, `libraryStore.ts`, `db.test.ts`, `backup.test.ts`, `ImportDialog.vue`, `app.ts`, `enrichmentQueue.test.ts`, `duplicates.test.ts`?**
  _High betweenness centrality (0.158) - this node is a cross-community bridge._
- **Should `SettingsPage.vue` be split into smaller, more focused modules?**
  _Cohesion score 0.1383399209486166 - nodes in this community are weakly interconnected._
- **Why does `vue` connect `CapturePage.vue` to `SettingsPage.vue`, `web/package.json`, `libraryStore.ts`, `AppShell.vue`, `ImportDialog.vue`, `ExportDialog.vue`, `vue-i18n`, `repositories.ts`, `QuickAddDialog.vue`, `dependencies`, `CommandPalette.vue`, `DraftReview.vue`, `TableCell.vue`, `FilterBar.vue`, `CellDisplay.vue`, `TableView.vue`, `OwnExampleCoach.vue`, `KanbanView.vue`, `enrichmentStore.ts`, `EnrichmentPage.vue`, `PriorityBars.vue`, `useTableScroll`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.14210526315789473 - nodes in this community are weakly interconnected._
- **Why does `vue-i18n` connect `vue-i18n` to `SettingsPage.vue`, `web/package.json`, `libraryStore.ts`, `AppShell.vue`, `ImportDialog.vue`, `ExportDialog.vue`, `repositories.ts`, `QuickAddDialog.vue`, `dependencies`, `CommandPalette.vue`, `DraftReview.vue`, `TableCell.vue`, `FilterBar.vue`, `CellDisplay.vue`, `TableView.vue`, `OwnExampleCoach.vue`, `KanbanView.vue`, `enrichmentStore.ts`, `EnrichmentPage.vue`, `PriorityBars.vue`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Should `server/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.14705882352941177 - nodes in this community are weakly interconnected._
- **Should `libraryStore.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.054363796650014694 - nodes in this community are weakly interconnected._