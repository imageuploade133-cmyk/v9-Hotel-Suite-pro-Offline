# 100% Offline Multi-User Realtime LAN & Cloud Sync Architecture

Transform v9 Hotel Suite Pro into a fully autonomous, offline-first system where multiple staff devices (tablets, mobile phones, POS terminals, front desk PCs) on the same Wi-Fi network interact in real time with instant product updates and stock deductions without requiring an active internet connection, while automatically syncing changes to Cloud Firestore when internet is available.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following core architectural decisions were confirmed during the requirements alignment phase and will govern the offline-first implementation:

- **Real-Time LAN Transport**: Confirmed **Server-Sent Events (SSE)** via `/api/lan-sync/events`. Eliminates complex separate WebSocket port management, runs natively over standard HTTP port 3000, and enables instant zero-configuration broadcasts of product additions, stock deductions, room check-ins, and payments across all connected devices on the Wi-Fi.
- **Authentication Strategy**: Confirmed **Dual Auth (Local + Cloud)**. When online, standard Firebase Authentication is used and staff credentials/profiles are securely cached into the Master Server local store. When offline, an offline login route (`/api/auth/offline-login`) validates credentials locally so staff can sign in, switch shifts, or log in from any Wi-Fi tablet without cloud connectivity.
- **Synchronization Engine**: Confirmed **Automatic Background Sync with Latest-Timestamp Conflict Resolution**. Mutations queued locally during internet blackouts automatically push to Cloud Firestore once internet connectivity is detected. Remote changes made from outside networks merge seamlessly back to the local database.

---

## 1. Overview & Core Concept

### What It Does
This architecture establishes the **Master Server PC** (the primary computer running the application at the hotel) as the authoritative local source of truth for all devices connected to the hotel Wi-Fi. 

- **Autonomous Offline Operation**: The front desk, restaurant/bar POS, kitchen docket display, laundry, and salon can operate continuously even if the internet cable is cut or the ISP is down.
- **Real-Time Cross-Device Sync**: When a bartender sells an item or a receptionist checks in a guest, the stock deduction and room occupancy change broadcast instantly to all connected screens in milliseconds via SSE.
- **Bi-Directional Cloud Reconciliation**: When the internet returns, queued mutations push in batches to Cloud Firestore without blocking staff workflows, and cloud updates hydrate back to the local store.

### Target Personas & Workflows
- **Front Desk Staff**: Check guests in and out, assign rooms, take room deposits, and print folios with zero latency even during internet outages.
- **POS / Bar / Restaurant Waitstaff**: Ring up sales, deduct inventory items from stock, hold tables, and send kitchen orders across Wi-Fi terminals.
- **Storekeeper & General Manager**: Monitor inventory levels, approve expenses, transfer funds between accounts, and review audit trails locally.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Offline Login Flow**:
   - Staff member opens `http://<SERVER_IP>:3000` on their tablet or laptop.
   - If offline, the login screen detects network state and presents a clear offline-ready login mode, authenticating against the Master PC's secure local cache.
   - Session tokens are maintained locally, granting immediate access based on staff role and assigned branches.
2. **Real-Time Sales & Stock Deduction Flow**:
   - Staff member adds a beverage or food item to a cart and hits "Complete Sale" on POS Terminal A.
   - The Master PC records the sale, atomistically deducts product quantity in `.lan-data/lan_db.json`, and emits an `inventory:updated` and `sale:created` event over SSE.
   - POS Terminal B, the Stock Keeper inventory list, and the Dashboard immediately reflect the deducted quantity and updated income without a page reload.
3. **Connectivity Status & Auto-Sync UI**:
   - A quiet top-bar connectivity indicator shows:
     - `Local Master (Wi-Fi Online)`: Indicates connection to the local server PC.
     - `Cloud Sync`: Displays "In Sync" or "X items pending upload" with a discreet pulse during active sync.
   - When internet is restored, a subtle non-intrusive toast confirms: "Cloud Sync Complete — All offline records synchronized."

### Visual Identity & Theme
- **Color Discipline**: Strict 60-30-10 distribution using clean neutral canvas (`bg-background`), hairline border dividers (`border-border`), and purposeful status colors (Emerald for in-sync, Amber for pending offline queue, Crimson for disconnected local server).
- **Typography**: Display headlines set in `Plus Jakarta Sans`, tabular figures enforced across all financial tables, quantities, and timestamps using `tabular-nums` and `font-mono`.
- **Zero-Pill Restraint**: Metadata (timestamps, sync IDs, mutation counters) formatted as unboxed clean text separated by typographic middots (`·`).

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Server-Sent Events (SSE) vs. WebSockets for Local Sync
- **Chosen Approach**: Server-Sent Events (SSE) streaming endpoint (`/api/lan-sync/events`) paired with standard HTTP POST mutations (`/api/lan-sync`).
- **Why**: SSE works out of the box with Next.js App Router on port 3000 without requiring custom server setups, reverse proxy upgrades, or additional firewall ports on local Windows/Linux machines. Reconnection is built into the browser `EventSource` API automatically.
- **Alternative Considered**: Raw WebSockets with Express (`ws`). Rejected because it requires tearing down Next.js standalone App Router packaging or running a secondary background daemon on a separate port that can be blocked by hotel router firewalls.

### Decision 2: Atomic Local Storage Engine (`.lan-data/lan_db.json`)
- **Chosen Approach**: File-backed structured JSON store with in-memory indexes and mutex write queues in `LanStore`.
- **Why**: Zero external dependencies (no C++ native compilation, no SQLite DLL mismatches across OS platforms, 100% portable across Windows, Mac, and Linux).
- **Stock Deduction Safety**: The Master Server runs an atomic deduction method inside `LanStore` (`deductStock(itemId, quantity)`), preventing race conditions when two waitstaff sell the last item simultaneously.

### Decision 3: Dual Authentication Model
- **Chosen Approach**: Hybrid auth provider that tries Firebase Auth first when internet is active; if unavailable or in offline mode, it checks PBKDF2/SHA-256 hashed password hashes stored in `lan_db.json` users collection.
- **Why**: Guarantees zero downtime when switching staff shifts during prolonged internet outages, while maintaining cloud auth sync when internet is available.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              HOTEL LOCAL WI-FI                                  │
│                                                                                 │
│   ┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐   │
│   │   Terminal 1: POS   │   │   Terminal 2: Desk  │   │  Terminal 3: Store  │   │
│   │   (Tablet / Phone)  │   │     (Reception)     │   │     (Laptop/PC)     │   │
│   └──────────┬──────────┘   └──────────┬──────────┘   └──────────┬──────────┘   │
│              │                         │                         │              │
│              │ HTTP POST / Mutations   │ HTTP POST / Mutations   │              │
│              │ SSE EventSource Listener│ SSE EventSource Listener│              │
│              ▼                         ▼                         ▼              │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                      MASTER SERVER PC (PORT 3000)                       │   │
│   │                                                                         │   │
│   │   ┌─────────────────────────────────────────────────────────────────┐   │   │
│   │   │ Next.js App Router & API Endpoints                              │   │   │
│   │   │  • /api/lan-sync (Read, Mutate, Deduct Stock)                   │   │   │
│   │   │  • /api/lan-sync/events (SSE Broadcaster)                       │   │   │
│   │   │  • /api/auth/offline-login (Local Credential Verifier)          │   │   │
│   │   │  • /api/lan-sync/cloud-sync (Auto Cloud Sync Engine)            │   │   │
│   │   └────────────────────────────────┬────────────────────────────────┘   │   │
│   │                                    │                                    │   │
│   │   ┌────────────────────────────────▼────────────────────────────────┐   │   │
│   │   │ LanStore Engine (.lan-data/lan_db.json)                         │   │   │
│   │   │  • Collections: stock, stockSales, bookings, payments, users    │   │   │
│   │   │  • Pending Mutation Queue with Timestamps                       │   │   │
│   │   │  • Atomic Deduct & Stock Validation Lock                        │   │   │
│   │   └────────────────────────────────┬────────────────────────────────┘   │   │
└────────────────────────────────────────┼────────────────────────────────────┘───┘
                                         │
                         (When Internet Becomes Available)
                                         │
                                         ▼
                 ┌───────────────────────────────────────────────┐
                 │             CLOUD FIREBASE (GCP)              │
                 │  • Cloud Firestore Collections                │
                 │  • Cloud Authentication                       │
                 │  • Remote Multi-Branch Centralization         │
                 └───────────────────────────────────────────────┘
```

### Component & Integration Plan

1. **Local Real-Time Broadcaster (`/api/lan-sync/events/route.ts`)**:
   - Implements Next.js streaming response using standard `TransformStream`.
   - Maintains an active client set on the server.
   - When any mutation or stock deduction occurs, broadcasts a lightweight event: `{ type: 'mutation', collection: 'stock', docId, action, data, timestamp }`.

2. **Client React Real-Time Hook Integration (`src/firebase/index.ts`)**:
   - Enhances `useCollection` and `useDoc` to subscribe to the local SSE event stream when running on local Wi-Fi.
   - On incoming SSE events, updates React state in real time without polling, matching Firebase `onSnapshot` performance offline.

3. **Atomic Stock Deduction Endpoint (`/api/lan-sync/stock-deduct/route.ts`)**:
   - Provides a dedicated transaction endpoint for cart checkouts:
     1. Verifies current available stock in `lan_db.json`.
     2. Atomically decrements quantity.
     3. Emits `stock:updated` event to all terminals.
     4. Records sale and payment documents.

4. **Offline Dual-Auth Provider (`src/components/auth/auth-provider.tsx`)**:
   - Gracefully catches Firebase Auth network failure.
   - Tries `/api/auth/offline-login` with user email and password against cached user records on the Master PC.
   - Populates user context with name, role, permissions, and assigned branches.

5. **Two-Way Background Cloud Sync Worker (`/api/lan-sync/cloud-sync/route.ts`)**:
   - Background interval / network status listener on the Master PC triggers sync when online.
   - Resolves conflicts using `updatedAt` / `timestamp` (latest write wins).
   - Clears synced items from the pending mutation queue.

---

## Verification Plan

### Automated Build & Unit Verification
- Run `npm run build` (`compile_applet`) to ensure all new endpoints and SSE streaming handlers compile cleanly with Next.js 14.2 App Router.
- Run `lint_applet` to verify zero type mismatches or syntax errors.

### Functional Scenarios
1. **Local Realtime Multi-User Test**: Simulate two browser clients on `localhost:3000`; deduct stock on Client A, verify Client B updates in real time via SSE without page refresh.
2. **Offline Login Test**: Disable internet simulation or disconnect Firebase; log in with valid cached credentials and verify session loads with full permissions.
3. **Queue Reconciliation Test**: Generate offline sales, trigger `/api/lan-sync/cloud-sync`, verify mutation queue drains and documents are marked synced.
