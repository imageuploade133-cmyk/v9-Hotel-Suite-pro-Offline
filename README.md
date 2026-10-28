# Hotel Suite Pro

A comprehensive, **100% Offline-Capable** hotel, restaurant, and property management system built with Next.js 14, React 18, TypeScript, and Firebase Cloud Sync.

---

## 🌟 100% Offline Local Master Server & Wi-Fi LAN Architecture

Hotel Suite Pro allows your hotel or restaurant to operate **100% offline with zero delay** across all staff phones, tablets, and computers connected to your local Wi-Fi router.

- **Zero Internet Dependency**: POS Billing, Room Check-ins, KOT Kitchen Printing, Laundry, Gym, Barbing Salon, and Stock Management run with 0 ms latency without internet.
- **Local Wi-Fi Multi-Device Sync**: Staff phones and reception PCs communicate directly over your local Wi-Fi router.
- **Multi-Year Local Persistence**: Data is saved directly on the Master PC's hard drive (`.lan-data/lan_db.json` & IndexedDB).
- **Auto Cloud Backup**: Automatically backs up all offline data to Cloud Firestore whenever internet is present.
- **Bluetooth ESC/POS Thermal Printing**: Instant thermal receipt printing over Web Bluetooth on mobile terminals and PCs.

---

## 📦 What to Download & Install (Complete List for Beginners)

To run Hotel Suite Pro as a Local Master Server on your central PC, download and install the following free software:

1. **Node.js (v18 or v20 LTS)**:
   - Download link: [https://nodejs.org/](https://nodejs.org/)
   - *Why*: Runs the server engine on your Master PC.
2. **Git**:
   - Download link: [https://git-scm.com/downloads](https://git-scm.com/downloads)
   - *Why*: Downloads and updates the codebase on your Master PC.
3. **pnpm Package Manager**:
   - Install via command line after Node.js is installed:
     ```bash
     npm install -g pnpm
     ```
4. **Google Chrome, Microsoft Edge, or Apple Safari Browser**:
   - Recommended browser for staff phones, tablets, and reception PCs.

---

## 🛠️ Step-by-Step Installation & Static IP Setup Guide

### STEP 1: Set a Static Local IP Address on your Master PC

To ensure staff phones and tablets always know where to connect, assign a Static IP Address on your Master PC:

#### On Windows 10/11:
1. Open **Settings** → **Network & Internet** → **Wi-Fi** or **Ethernet**.
2. Click on your connected network and select **Edit** next to **IP Assignment**.
3. Change assignment from **Automatic (DHCP)** to **Manual**, and turn on **IPv4**.
4. Enter your desired Static IP (e.g., `192.168.1.100`):
   - **IP Address**: `192.168.1.100`
   - **Subnet Prefix Length**: `24` (or Subnet Mask `255.255.255.0`)
   - **Gateway**: `192.168.1.1` (Your Wi-Fi Router's IP)
5. Click **Save**.

#### On macOS:
1. Open **System Settings** → **Network** → Select your Wi-Fi/Ethernet network.
2. Click **Details...** → Select **TCP/IP** tab.
3. Change **Configure IPv4** to **Using DHCP with manual address**.
4. Set IP Address to `192.168.1.100` and click **OK**.

---

### STEP 2: Download & Install Hotel Suite Pro Codebase

Open Command Prompt (Windows) or Terminal (macOS/Linux) and run:

```bash
# 1. Clone the repository onto your Master PC
git clone https://github.com/imageuploade133-cmyk/v9-Hotel-Suite-pro-Offline.git

# 2. Navigate into the project folder
cd v9-Hotel-Suite-pro-Offline

# 3. Install required software dependencies
pnpm install
```

---

### STEP 3: Build & Launch Local Master Server

```bash
# 1. Build the production application bundle (one-time setup)
pnpm build

# 2. Launch Local Master Server Mode
# On Windows: Double-click "start-master-server.bat" in the folder
# On macOS / Linux: Open terminal and run "./start-master-server.sh"
```

The server launcher will start and display:
```text
==============================================================================
            HOTEL & RESTAURANT LOCAL MASTER SERVER INITIALIZER
==============================================================================
[INFO] Starting Local Master Server on host 127.0.0.1 (Port 3000)...
[LAN NETWORK IP] http://192.168.1.100:3000
==============================================================================
```

---

### STEP 4: Connect Staff Phones, Tablets & Reception PCs over Wi-Fi

1. Turn on your Hotel / Restaurant **Wi-Fi Router**.
2. Connect all staff mobile phones, tablets, and reception PCs to this Wi-Fi network. *(No internet subscription is required on the router!)*
3. On any staff phone or tablet, open Google Chrome or Safari and enter:
   ```text
   http://192.168.1.100:3000
   ```
4. **Tip**: On Android/iOS, tap the browser menu (⋮) and select **Add to Home Screen** to create a 1-tap app icon!

---

### STEP 5: Connect Bluetooth Thermal Printers (Handheld POS)

1. Turn on your Bluetooth ESC/POS thermal receipt printer.
2. Pair the printer in your Android/iOS phone Bluetooth settings.
3. Open the POS page (`http://192.168.1.100:3000/pos`) on your phone.
4. When completing an order, tap **Print via Bluetooth** to pair and print receipts or kitchen dockets instantly!

---

## 📋 Core Modules & Pages

- **Hotel Management**: Room availability grid, active check-ins, reservations, housekeeping status.
- **POS & Restaurant**: Bar/Restaurant order taking, running tables, product sales, credit sales, POS accounting.
- **Services**: Kitchen display/printing (KOT), barbing salon orders, laundry workflow, gym memberships.
- **Inventory**: Global stock management, low-stock alerts, restock orders, supplier management.
- **Financials**: Guest folios, room bills, expense records, staff salary/dockets, payment logs.

---

## 📖 Complete Documentation Files

- `OFFLINE_LAN_SYNC_GUIDE.md` - Complete network architecture, router setup, and offline data sync guide.
- `WHATSAPP_QUICKSTART.md` - WhatsApp messaging setup instructions.

---

## 🧪 System Health Check Commands

```bash
# Verify TypeScript compile safety
pnpm typecheck

# Run linter
pnpm lint
```

---

## 📄 License & Status

**Version**: 9.0
**Status**: ✅ 100% Offline LAN & Production Ready
