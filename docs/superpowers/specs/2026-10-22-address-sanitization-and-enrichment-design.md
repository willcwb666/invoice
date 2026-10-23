# Design Spec: Address Sanitization, Normalization & Automatic Enrichment

**Date:** 2026-10-22
**Status:** Approved by User (Abordagem 1)
**Authors:** Antigravity & Engineering

---

## 1. Problem Statement

1. **iCloud / Apple Calendar Address Noise:**
   - Apple Calendar stores addresses with multi-line placemarks, including newlines (`\n`), country names (`United States`, `USA`), and raw geocoded text:
     - Example (Amber): `"2109 Outer Banks Ct\nWindsor, CO, United States"`
     - Example (Alissa): `"3068 Aries Drive, Loveland"`
     - Example (Chelsea): `"1106 78th Avenue Ct\nGreeley, CO, United States"`
2. **Frontend String Concatenation Corruption:**
   - When screens (`ClientDetailPage`, `ClientModal`) concatenate `${client.address}, ${client.city}, ${client.state} ${client.zipCode}`, the resulting string becomes:
     `"2109 Outer Banks Ct\nWindsor, CO, United States, Windsor - CO 80550"`
   - This causes:
     - RentCast API to fail or return 0 results.
     - Repeated city names (`Windsor, Windsor`, `Loveland, Loveland`).
     - Newlines breaking single-line inputs and query parameters.
3. **Database Dirtiness:**
   - 131 clients currently exist in the database with raw unparsed strings in `prisma.client.address`.
   - Many lack `bedrooms`, `bathrooms`, and `squareFeet` because the initial iCloud background enrichment failed on the malformed strings.

---

## 2. Technical Architecture & Solutions

### A. Dedicated Engine: `AddressNormalizer` (`src/lib/address-normalizer.ts`)
A centralized, zero-dependency address parsing and cleaning utility:
- **`normalizeAddress(raw: string, defaultCity?: string, defaultState?: string, defaultZip?: string)`**:
  - Replaces `\n` and `\r` with commas/spaces.
  - Removes trailing country identifiers (`United States`, `USA`, `US`).
  - Normalizes hyphens before states (`- CO` -> `, CO`).
  - Deduplicates repeated city and state tokens (`Windsor, Windsor` -> `Windsor`).
  - Extracts components:
    - `street`: clean street line (e.g. `"2109 Outer Banks Ct"`).
    - `city`: detected city (e.g. `"Windsor"`).
    - `state`: 2-letter state code (e.g. `"CO"`).
    - `zipCode`: 5-digit zip code (e.g. `"80550"`).
    - `fullAddress`: `"2109 Outer Banks Ct, Windsor, CO 80550"`
    - `fallbackAddress`: `"2109 Outer Banks Ct, Windsor, CO"` (without zip code, to overcome tax district zip code mismatches).

### B. Integration into `RentCastService` (`src/services/rentcast-service.ts`)
- Uses `AddressNormalizer.normalizeAddress` before every API call.
- Executes search with `fullAddress`.
- If 0 results are returned and `fallbackAddress` is different, immediately queries with `fallbackAddress`.
- If successful, returns the property data and the official `formattedAddress` from RentCast.

### C. Integration into UI (`ClientModal` & `ClientDetailPage`)
- In `ClientDetailPage`: uses `AddressNormalizer` to construct the query and displays the clean street in the address card.
- In `ClientModal`: uses `AddressNormalizer` when parsing user input or suggestions.

### D. Integration into iCloud Sync (`src/lib/calendar/icloud.ts`)
- When creating new clients during sync, passes `event.location` through `AddressNormalizer`:
  - Saves clean `street` to `client.address`.
  - Saves clean `city`, `state`, and `zipCode` to their respective columns.
  - Calls `RentCastService.fetchProperty` with the sanitized address to guarantee background enrichment works on first import.

### E. Database Hygiene Script (`scripts/sanitize-client-addresses.ts`)
- Script that can be run with `pnpm exec tsx scripts/sanitize-client-addresses.ts`:
  - Iterates over all clients in `prisma.client`.
  - Parses and updates `address`, `city`, `zipCode` to clean values.
  - For clients without `bedrooms`/`squareFeet`, calls `RentCastService.fetchProperty` to backfill property dimensions!

---

## 3. Verification Plan
- Unit tests in `src/__tests__/address-normalizer.test.ts` testing:
  - Multi-line iCloud addresses (`\nWindsor, CO, United States`).
  - Duplicated city and hyphenated state (`Loveland, Loveland - CO 80538`).
  - Full address vs fallback address generation.
- Unit tests in `src/__tests__/rentcast-service.test.ts`.
- Database script dry-run and execution.
- Production build validation (`pnpm build`).
