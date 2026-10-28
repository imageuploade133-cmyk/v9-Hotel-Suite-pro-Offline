# 100% Offline Local Master Server & Firestore Cloud Sync Architecture

This guide provides the complete setup, configuration, and operational instructions for running your Hotel & Restaurant Management System **100% offline with zero delay** using a Local Master Server over Wi-Fi LAN, with automatic background synchronization to **Cloud Firestore** whenever internet connectivity is available.

---

## Architecture Overview

```
 [Bar Phone Terminals]     [Hotel Reception PC]     [Room Order Phones / Handheld Terminals]
        |                           |                                 |
        +---------------------------+---------------------------------+
                                    |
                           (Local Wi-Fi Router)
                                    |
                      [Local Master Server PC (LAN)]
                        http://192.168.1.100:3000
                                    |
                 +------------------+------------------+
                 |                                     |
    [Instant Local Response]              [Background Cloud Sync Worker]
  - IndexedDB Persistent Cache            - Auto-detects WAN Internet
  - LAN Mutation Queue Store              - Syncs to Cloud Firestore
```

---

## 1. Local Master Server Setup (Hotel Desk / PC)

### Requirements
- **Master PC**: Any Windows 10/11 or macOS / Linux desktop or laptop connected to your Wi-Fi Router via Ethernet cable or Wi-Fi.
- **Static Local IP Address**: Assign a static IP on your Master PC (e.g., `192.168.1.100`).

### Launching the Local Master Server
1. Clone or copy the repository onto the Master PC.
2. Build the production application (one time):
   ```bash
   pnpm build
   ```
3. Run the automated Local Master Launcher script:
   - **Windows**: Double-click `start-master-server.bat`
   - **macOS / Linux**: Run `./start-master-server.sh`
4. The Master Server will launch bound to `0.0.0.0:3000` and display your Master PC Local IP address (e.g. `http://192.168.1.100:3000`).

---

## 2. Staff Device Connections (Phones, Tablets & Reception PCs)

All staff members connect to the same hotel/restaurant Wi-Fi network:

1. Open the web browser (Chrome, Safari, Edge) on any staff phone or tablet.
2. Navigate to:
   ```text
   http://192.168.1.100:3000
   ```
3. Bookmark the link or add it to the device home screen as a Web App icon.

### Instant 0 ms Offline Response
- **Reads & Writes**: Executed immediately against local IndexedDB persistent storage on each client and local LAN store on the Master PC.
- **Zero Internet Dependency**: POS orders, room check-ins, bar orders, and KOT kitchen printing respond with 0 ms latency even if the internet cable is unplugged.

---

## 3. Handheld POS Terminals & Bluetooth Thermal Printer Setup

For staff using phone terminals with integrated Bluetooth printers or portable Bluetooth thermal printers:

1. Turn on the Bluetooth printer and enable Bluetooth on the handheld phone/terminal.
2. Open the POS page on the phone (`http://192.168.1.100:3000/pos`).
3. When printing a bill or docket, tap **Print via Bluetooth**.
4. Select your Bluetooth ESC/POS thermal printer from the browser prompt.
5. Future print jobs stream directly over Web Bluetooth GATT without touching external networks.

---

## 4. Background Cloud Sync to Firestore

- **Local Queueing**: While offline, every order, guest payment, booking update, and stock movement is assigned a unique mutation ID and stored in `.lan-data/lan_db.json` on the Master PC.
- **Automatic Sync**: The background sync worker checks WAN internet availability every 10 seconds.
- **Cloud Backup**: When internet is present, the worker pushes all pending mutations to Cloud Firestore and marks them as synced.
- **Visual Monitor**: Staff can monitor the LAN and Cloud status indicator in the app header:
  - `LAN 100% Active` (Green)
  - `Cloud Ready` (Blue when online) / `Cloud Offline (Saving Locally)` (Amber when offline)
  - `Sync Queue` badge (Shows count of pending records queued for cloud backup)

---

## 5. Troubleshooting & FAQ

### Q1: What if the internet goes completely out for days?
**Answer**: Operations are 100% unaffected. All billing, room management, KOT printing, and stock actions continue at full speed locally. As soon as internet returns, all backlogged data will sync to Cloud Firestore automatically.

### Q2: What if the Master PC restarts?
**Answer**: Simply double-click `start-master-server.bat` (Windows) or `./start-master-server.sh` (macOS/Linux) to resume the Master Server. You can also add `start-master-server.bat` to the Windows Startup folder (`shell:startup`) for automatic boot on power restoration.

### Q3: How do staff find the Master PC IP address?
**Answer**: The launcher script (`start-master-server.bat` / `start-master-server.sh`) displays the exact local IP address in large text when it starts. You can also check your Wi-Fi router's connected devices page.
