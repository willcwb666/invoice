# RentCast Property Integration & Address Autofill — Design

## Context & Intent

In a residential and commercial cleaning service business, operational duration and pricing proposals depend directly on the structural characteristics of the property:
- **Square Footage (`squareFeet`)**: Determines base cleaning duration and square-foot pricing tiers.
- **Bedrooms (`bedrooms`)**: Determines linen changes, dusting scope, and room count.
- **Bathrooms (`bathrooms`)**: Heavily influences labor intensity and sanitation supply consumption.

Currently, `Client` records only store a text `address` string, `city`, `state`, and `zipCode`. Users must manually ask clients for property sizes or look them up externally on Zillow/Redfin.

This design introduces:
1. **US Address Autocomplete via Mapbox Address Autofill**: Fast, free, type-ahead completion of residential addresses with automatic parsing into street, city, state, and zip code.
2. **Automated Property Enrichment via RentCast API**: Automatic extraction of bedrooms, bathrooms, square footage, and property type from the property address.
3. **Dual Triggering Workflow**:
   - **Interactive Modal**: As soon as the user selects or finishes typing an address (on blur), a toast displays *"Consultando dados do imóvel na RentCast..."* and automatically fills the Beds, Baths, and SqFt inputs, while keeping them completely editable for manual adjustments.
   - **Background iCloud Sync**: When the system syncs appointments from the iPhone/iCloud calendar and encounters a new client address without property data, it enriches the client record in the background without blocking agenda loading.

---

## Comparison: Google Places API vs. Mapbox Address Autofill

| Feature | Google Places API (New) | Mapbox Address Autofill | Winner / Decision |
| :--- | :--- | :--- | :--- |
| **Free Monthly Tier** | \$200 Google Cloud credit (~7,000 autocompletes/mo) | **100,000 free requests/month** | **Mapbox** (14x more generous) |
| **Billing Setup** | Requires mandatory Credit Card & Google Cloud Console project | **Zero credit card required** to get started | **Mapbox** (No surprise billing) |
| **Form Integration** | Complex session token lifecycle management | Ready-to-use search box / autofill component | **Mapbox** (Cleaner React integration) |
| **Address Quality in USA** | Excellent | Excellent (official USPS / US residential dataset) | **Tie** |

**Decision:** We choose **Mapbox Address Autofill** for address autocompletion and **RentCast API** for property structural attributes.

---

## Approaches Considered

### Approach 1: Instant Modal Autofill on Blur + Background iCloud Enrichment (Selected)
- **Modal Behavior:** Exiting the address field (`onBlur`) triggers an API call to `/api/v1/properties/lookup?address=...`. A toast informs the user (*"Consultando dados do imóvel..."*). When found, inputs for Quartos, Banheiros, and Tamanho (SqFt) are populated, followed by a success toast (*"✓ Imóvel encontrado: 3 qts, 2 banh, 1.878 sqft"*). Fields remain editable.
- **iCloud Sync Behavior:** As new calendar events are imported, any newly created client with a valid address is queued for background property lookup.
- **Pros:** Zero extra clicks for the user, immediate visual feedback, works across both manual registration and automated calendar sync.

### Approach 2: Manual Button "Buscar Imóvel" on Modal
- **Modal Behavior:** The user types the address and must click a button "Buscar dados na RentCast".
- **Cons:** Requires extra clicks, slower for quick mobile entry. Rejected in favor of Approach 1 per user choice.

---

## Goals

1. Enhance `model Client` in Prisma schema with `bedrooms (Int?)`, `bathrooms (Float?)`, `squareFeet (Int?)`, and `propertyType (String?)`.
2. Implement `RentCastService` (`src/services/rentcast-service.ts`) with in-memory / database lookup caching to prevent wasting monthly API quota.
3. Expose route `GET /api/v1/properties/lookup?address=...` with rate limiting and authentication.
4. Integrate Mapbox Address Autofill in `ClientModal` with automatic RentCast lookup on blur.
5. Provide live toast feedback during lookup.
6. Extend `CalendarSyncService` to enrich newly imported clients with property data in the background.
7. Display property metrics prominently on Client Profile (`/clients/[id]`) and as subtle badges on the Clients list (`/clients`).

---

## Non-Goals

- Replacing Google/Apple Maps GPS route calculation (navigation will still use Apple Maps / Google Maps links as designed).
- Estimating property rental or market value (only physical structure attributes are captured: beds, baths, sqft, property type).
- Blocking client creation if RentCast fails or property is not found (all property fields are optional with graceful fallback to manual entry).

---

## Data Model Changes

In `prisma/schema.prisma`:

```prisma
model Client {
  id           String         @id @default(uuid())
  companyId    String
  company      CompanyProfile @relation(fields: [companyId], references: [id], onDelete: Cascade)
  name         String
  email        String?
  phone        String?
  address      String         // Full address for GPS route
  city         String?
  state        String?        @default("CO")
  zipCode      String?
  billingType  BillingType    @default(PER_JOB)
  notes        String?
  
  // New Property Dimension Fields:
  bedrooms     Int?           // Number of bedrooms (e.g. 3)
  bathrooms    Float?         // Number of bathrooms (e.g. 2.5)
  squareFeet   Int?           // Total interior living area (e.g. 1878)
  propertyType String?        // e.g. "Single Family", "Condo", "Townhouse"

  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  appointments Appointment[]
  invoices     Invoice[]
  estimates    Estimate[]

  @@index([companyId])
  @@map("clients")
}
```

---

## API Specifications

### `GET /api/v1/properties/lookup`
- **Query Params:**
  - `address` (string, required): Full address or street line.
  - `city` (string, optional)
  - `state` (string, optional, default "CO")
  - `zipCode` (string, optional)
- **Headers:** Session cookie or Bearer token (protected route).
- **External Call:** `GET https://api.rentcast.io/v1/properties?address={encodedAddress}` with header `X-Api-Key: process.env.RENTCAST_API_KEY`.
- **Response Format:**
  ```json
  {
    "success": true,
    "found": true,
    "data": {
      "formattedAddress": "2631 Blackstone Ct, Fort Collins, CO 80525",
      "bedrooms": 3,
      "bathrooms": 2.5,
      "squareFeet": 1878,
      "propertyType": "Single Family",
      "yearBuilt": 1998
    }
  }
  ```
- **Fallback on Not Found / Error:** Returns `{ success: true, found: false, message: "Imóvel não localizado na base RentCast." }` with status 200 so the UI doesn't crash and user can fill manually.

---

## User Interface & Experience

### 1. `ClientModal` ([`src/components/ui/client-modal.tsx`](file:///c:/projetos/invoice/src/components/ui/client-modal.tsx))
- **Address Input:** Enhanced with Mapbox Address Autofill dropdown for instant US address suggestions.
- **On Blur Event:** When the address field loses focus (and has at least 5 characters including digits):
  1. Shows toast: *"Consultando dados do imóvel na RentCast..."*
  2. Dispatches lookup to `/api/v1/properties/lookup`.
  3. If found:
     - Populates `bedrooms`, `bathrooms`, `squareFeet`.
     - Shows success toast: *"✓ Imóvel encontrado: 3 qts, 2.5 banh, 1.878 sqft"*
  4. If not found:
     - Leaves fields blank for manual entry without blocking form submission.
- **New Input Group:**
  - **Quartos:** Numeric stepper / input (`min="0" step="1"`).
  - **Banheiros:** Numeric stepper / input (`min="0" step="0.5"` to allow 1.5, 2.5).
  - **Área (SqFt):** Numeric input with suffix `sqft` (e.g., `1,800`).

### 2. Client Profile ([`src/app/(dashboard)/clients/[id]/page.tsx`](file:///c:/projetos/invoice/src/app/(dashboard)/clients/[id]/page.tsx))
- Adds a **Dimensões do Imóvel** card displaying:
  - `🛏️ X Quartos`
  - `🚿 Y Banheiros`
  - `📐 Z sqft`
  - `🏠 Tipo de Imóvel`
- Includes a *"Sincronizar RentCast"* action button to re-fetch or refresh property dimensions on demand.

### 3. Clients List ([`src/app/(dashboard)/clients/page.tsx`](file:///c:/projetos/invoice/src/app/(dashboard)/clients/page.tsx))
- Under the client name or address, renders a compact pill badge: `3 qts • 2.5 banh • 1.878 sqft` when present.

---

## Environment Variables

- `RENTCAST_API_KEY`: API Key obtained free from [RentCast.io](https://rentcast.io).
- `NEXT_PUBLIC_MAPBOX_TOKEN`: Public token obtained free from [Mapbox.com](https://mapbox.com) for address autofill.
