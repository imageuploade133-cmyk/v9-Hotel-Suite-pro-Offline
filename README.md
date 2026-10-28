# Hotel Suite Pro

A comprehensive, **100% Offline-Capable** hotel, restaurant, and property management system built with Next.js 14, React 18, TypeScript, and Firebase Cloud Sync.

---

## 🌟 100% Offline & Local Wi-Fi Master Server Mode

Hotel Suite Pro supports **100% Offline Operation over Local Wi-Fi (LAN Mode)**.

- **Zero Internet Dependency**: All daily operations—POS Billing, Room Check-ins, KOT Kitchen Printing, Barbing Salon, Laundry, Gym, Inventory/Stock Management, and Guest Folios—run completely offline with 0 ms response delay.
- **Multi-Device Wi-Fi Sync**: All staff phones, tablets, and reception PCs connect to the Local Master PC (`http://<MASTER_PC_IP>:3000`) over your local Wi-Fi router.
- **Multi-Year Local Storage**: Transactions, check-ins, and stock entries are stored locally on the Master PC (`.lan-data/lan_db.json` & IndexedDB) for months or years without needing internet.
- **Automatic Cloud Firestore Sync**: Whenever internet is connected, the background sync engine automatically queues and pushes all offline data to Cloud Firestore for permanent cloud backup.
- **Web Bluetooth Printing**: Direct ESC/POS thermal printing over Web Bluetooth on handheld POS phone terminals and reception PCs.

---

## 🚀 How to Install & Run Offline on Any Computer

### Step 1: Install Node.js & pnpm
1. Download and install [Node.js 18+](https://nodejs.org/).
2. Install `pnpm` (recommended):
   ```bash
   npm install -g pnpm
   ```

### Step 2: Download & Install Project
```bash
# Clone the repository
git clone https://github.com/imageuploade133-cmyk/v9-Hotel-Suite-pro-Offline.git

# Navigate into project directory
cd v9-Hotel-Suite-pro-Offline

# Install dependencies
pnpm install
```

### Step 3: Build & Launch Local Master Server
```bash
# Build production bundle (one time)
pnpm build

# Launch Local Master Server
# On Windows: Double-click start-master-server.bat
# On macOS / Linux: Run ./start-master-server.sh
```

The script will launch the application and display your Master PC Local IP address:
```text
[LAN NETWORK IP] http://192.168.1.100:3000
```

### Step 4: Connect Staff Devices on Wi-Fi
On any staff phone, tablet, or reception computer connected to the same Wi-Fi router, open the browser and navigate to:
```text
http://192.168.1.100:3000
```

---

## 📋 Core Features

- **Hotel Operations**: Real-time room availability, reservations, active check-ins, housekeeping, guest folios.
- **Point of Sale (POS)**: Product sales, running tables, credit sales, refunds, POS accounting, categories.
- **Services**: Kitchen orders (KOT), restaurant, barbing salon, gym, laundry management.
- **Inventory & Finance**: Global stock management, restock alerts, suppliers, expenses, payments, salary/dockets.
- **Thermal Printing**: ESC/POS Bluetooth printing on handheld phone terminals and thermal receipts on reception PCs.
- **Automation**: WhatsApp notifications (via eBulkSMS & Google Apps Script), daily reports, guest feedback.
- **AI Features**: Genkit image generation for restaurant menus using Google Imagen.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router), React 18, TypeScript
- **UI & Styling**: Tailwind CSS, Radix UI, Framer Motion, Lucide Icons
- **Database & Offline Engine**: Local Master Persistence Store (`lan-store`), IndexedDB Cache, Cloud Firestore
- **Hardware Integrations**: Web Bluetooth ESC/POS Printers, LAN Thermal Printers
- **Messaging & Alerts**: eBulkSMS WhatsApp API, Google Apps Script Web App

---

## 📂 Project Structure

```text
src/
├── app/                    # Next.js App Router (pages & API routes)
│   ├── api/lan-sync/      # Local Master LAN sync & Cloud backup endpoints
│   ├── (auth)/            # Authentication routes
│   └── (protected)/       # Protected app pages
├── components/            # React UI components
│   └── lan-sync/          # LAN sync status monitor indicator
├── firebase/              # Firebase initialization & offline persistence config
├── lib/
│   ├── lan-sync/          # Local JSON persistent store engine
│   └── bluetooth-printer  # Web Bluetooth ESC/POS thermal printer driver
└── start-master-server.bat/sh # Automated Master PC startup launchers
```

---

## 🚦 Quick Setup & Configuration

### 1. Firebase Setup (Optional for Cloud Sync)
1. Add your Firebase credentials in `.env.local` or environment variables:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

### 2. WhatsApp Messaging Credentials
Add your eBulkSMS details in **Settings → Page 2 → EbulkSMS Settings**:
- **Username**: `electro1@emakemrnd.com.ng`
- **API Key**: `4e72ff9e21f1e875834598daeacfd997a892bca332fce1a90804cb15ca2da398`

---

## 📖 Documentation

- `OFFLINE_LAN_SYNC_GUIDE.md` - Complete 100% Offline LAN Master Server & Cloud Sync Guide.
- `WHATSAPP_QUICKSTART.md` - WhatsApp messaging setup.
- `WHATSAPP_FIX_SUMMARY.md` - Technical details on WhatsApp delivery fixes.

---

## 🧪 Verification & Type Check

```bash
# Type check
pnpm typecheck

# Linting
pnpm lint
```

---

## 📄 License & Status

**Version**: 9.0
**Status**: ✅ 100% Offline LAN & Production Ready
