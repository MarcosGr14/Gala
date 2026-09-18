# KPop Gala — Hall of Fame

A local-first music awards archive built with Vanilla JavaScript, Vite, Dexie / IndexedDB and Vitest.

## Run

Node.js 20.19+ or 22.12+ is required by Vite. Recommended: Node.js 24 LTS.

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Keep using the same browser and URL (including hostname and port) to access your existing archive. IndexedDB belongs to an origin. Export a backup before switching devices, browsers or URLs.

## Using the archive

- Home draws its spotlight, records, recent winners and top artists from real results. It does not create sample winners.
- Artists and Groups open profiles; links also work for songs, albums, music videos, performances, outfits and documentaries.
- Gala has a year selector and a keyboard-accessible presentation (left / right arrows, Escape to exit).
- Admin provides focused creation forms and a searchable collection editor. Archive/unarchive preserves IDs, relations and award history.
- Register Award searches categories and winners. Create missing winners inside the dialog without losing the current season/category or selected winners.
- Add photos through the image URL fields. Missing or unavailable images receive a monogram, not a broken image.
- Category rules can be configured before use. Structural rule changes on categories with results require a new category, preserving existing history.

## Counting rules

- An AwardResult is one distributed award. A pair or multiple-winner result remains one award.
- Each winning artist receives one direct win per result.
- Associated group wins count only idol winners with a qualifying membership in that season.
- Membership intervals overlap the calendar year, with inclusive start/end boundaries. Season data has year precision; the app does not invent award dates.
- Undated current memberships retain legacy compatibility. Former memberships without an end date are excluded from associations until corrected.
- Legacy is the union of direct group results and eligible member results, deduplicated by result ID. A mixed result naming a group and its member is counted once.
- Daesangs use the same direct / associated / union rules.
- Song or album wins belong directly to the work. Creator credits are displayed as relationships; they do not silently become direct artist wins.
- maleFemale and userGenderSlots store one result per slot. Pair and multiple structures store one shared result. Slot labels are editable on unused categories.
- The default Bias slots are user1 and user2; customize their identifiers in Categories before registering results.
- Win rate is matched winning nominations divided by distinct recorded nominations (season/category/slot), not all wins divided by an incomplete nomination list.
- Best season uses direct results for idols, Legacy for groups. Ties choose the latest year. Leaderboard ties share a rank.
- All statistical derivations are read-only. One snapshot per view avoids database queries per card.

## Data and recovery

The database name remains `KPopGalaDatabase`.

Schema v2 preserves the original tables/IDs, adds documentaries and local restore points, adds a compound award lookup index, normalizes legacy membership status labels, and fills missing category metadata. It adds missing default categories without overwriting existing names or IDs.

Backups include all archive tables and audit history, plus schema/app versions and a timestamp. Recovery points are local operational history, kept separately to avoid recursively embedding backups. Download a recovery point from Admin to retain it outside the browser.

Restore validates table shapes, unique IDs, references and winner structures, previews counts, then asks for confirmation. Replacement and recovery-point creation are one transaction: a failure rolls everything back. Legacy v1 files preserve omitted media tables from the current archive, provided their references remain valid. Future schema versions are rejected.

No cloud service or account is needed. Photos and optional Google Fonts require their respective URLs to remain accessible; local fonts and monograms are fallbacks.

## Code layout

- `src/data`: database, initial categories, entity and form definitions
- `src/services`: catalog/award writes, validation, resolver, statistics and backup
- `src/components`: accessible autocomplete, cards, dialogs and toasts
- `src/views`: Home, directories, Gala, profiles, Records and focused Admin modules
- `src/css`: tokens, base styles, layout, cards and forms
- `test`: pure logic and isolated IndexedDB integration tests

Tests use fake-indexeddb with disposable database names. They never open the real browser archive.

