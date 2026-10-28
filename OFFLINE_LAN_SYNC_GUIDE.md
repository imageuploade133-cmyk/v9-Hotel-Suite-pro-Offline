# 100% Offline Local Master Server & Wi-Fi Setup Guide

This document provides step-by-step instructions for hotel/restaurant owners and IT administrators to set up the Hotel & Restaurant Management System **100% offline over local Wi-Fi (LAN)** with automatic background sync to **Cloud Firestore**.

---

## 🏗️ Architecture Summary

```
 [Bar Mobile Phones]        [Hotel Reception PC]        [Room Service Phones]
        |                            |                             |
        +----------------------------+-----------------------------+
                                     |
                          (Hotel Wi-Fi Router)
                                     |
                       [Local Master Server PC]
                      http://192.168.1.100:3000
                                     |
            +------------------------+------------------------+
            |                                                 |
  [Instant Local Storage]                            [Cloud Sync Worker]
  - IndexedDB Browser Storage                         - Monitors Internet Connection
  - Master PC JSON Store (.lan-data)                  - Syncs to Cloud Firestore
```

---

## 📥 Required Software Downloads

Before starting, download and install these software tools on your Master PC:

1. **Node.js (v18 or v20 LTS)**: [https://nodejs.org/](https://nodejs.org/)
2. **Git**: [https://git-scm.com/downloads](https://git-scm.com/downloads)
3. **pnpm Package Manager**:
   Open Command Prompt / Terminal and run:
   ```bash
   npm install -g pnpm
   ```

---

## 📶 Setting Up a Static IP Address on Master PC

Assigning a Static IP ensures the Master PC IP address never changes when rebooted:

### Windows 10/11:
1. Open **Settings** → **Network & Internet** → **Wi-Fi / Ethernet**.
2. Click **Edit** next to **IP Assignment**.
3. Select **Manual**, turn on **IPv4**, and enter:
   - **IP Address**: `192.168.1.100`
   - **Subnet Prefix**: `24`
   - **Gateway**: `192.168.1.1`
4. Click **Save**.

---

## 🚀 Step-by-Step Server Setup

### Step 1: Clone Repository & Install Dependencies
```bash
git clone https://github.com/imageuploade133-cmyk/v9-Hotel-Suite-pro-Offline.git
cd v9-Hotel-Suite-pro-Offline
pnpm install
```

### Step 2: Build Production Bundle
```bash
pnpm build
```

### Step 3: Run Master Server Launcher
- **Windows**: Double click `start-master-server.bat`
- **macOS / Linux**: Execute `./start-master-server.sh`

---

## 📱 Connecting Staff Devices over Wi-Fi

1. Connect all staff phones, tablets, and POS terminals to the hotel Wi-Fi router.
2. Open Google Chrome or Safari on staff phones and navigate to:
   ```text
   http://192.168.1.100:3000
   ```
3. Bookmark or add the link to the phone home screen for 1-tap access.

---

## printer Bluetooth ESC/POS Thermal Printing

For staff taking orders on mobile phones or handheld POS terminals:
1. Turn on the Bluetooth thermal printer.
2. Pair the printer in phone settings.
3. Open `http://192.168.1.100:3000/pos`.
4. Tap **Print via Bluetooth** to stream ESC/POS print commands directly to the thermal printer.

---

## ☁️ Automatic Background Cloud Sync

- **Offline Mode**: When internet is down, all transaction mutations (POS orders, check-ins, guest payments) are recorded with 0 ms delay locally on the Master PC.
- **Online Backup**: When internet is restored, the background sync engine pushes queued transactions to Cloud Firestore for cloud backup automatically.
