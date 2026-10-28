# Hotel Suite Pro

A comprehensive, **100% Offline-Capable** hotel, restaurant, and property management system built with Next.js 14, React 18, TypeScript, and Firebase Cloud Sync.

---

## 🌟 100% Offline Local Master Server & Wi-Fi LAN Architecture

```text
 ┌─────────────────────────────────────────────────────────────────────────────────────────┐
 │                                   HOTEL WI-FI ROUTER                                    │
 │                                   (No Internet Needed)                                  │
 └─────────────────────────────┬───────────────────────────────┬───────────────────────────┘
                               │                               │
                               ▼                               ▼
                   ┌───────────────────────┐       ┌───────────────────────┐
                   │  BAR MOBILE PHONE POS │       │ ROOM SERVICE TABLETS  │
                   │ http://192.168.1.100:3000│       │http://192.168.1.100:3000│
                   └───────────┬───────────┘       └───────────┬───────────┘
                               │                               │
                               └───────────────┬───────────────┘
                                               │
                                               ▼
                               ┌───────────────────────────────┐
                               │     LOCAL MASTER SERVER PC    │
                               │  - Static IP: 192.168.1.100   │
                               │  - Next.js Server Engine      │
                               │  - Persistent LAN DB (.json)  │
                               └───────────────┬───────────────┘
                                               │
                                               ▼
                               ┌───────────────────────────────┐
                               │  BACKGROUND CLOUD SYNC WORKER │
                               │  (Syncs to Cloud Firestore    │
                               │   when internet is active)    │
                               └───────────────────────────────┘
```

---

## 📸 Step-by-Step Visual Setup Guide

### 1. Static IP Configuration Diagram (Windows 10/11)

```text
 Settings > Network & Internet > Ethernet / Wi-Fi > Edit IP Settings:
 ┌───────────────────────────────────────────────────────────┐
 │ Edit IP settings                                          │
 │ [ Manual ]                                                │
 │ IPv4: [ ON ]                                              │
 │                                                           │
 │ IP Address:        [ 192.168.1.100                    ] │
 │ Subnet mask:       [ 255.255.255.0                    ] │
 │ Gateway:           [ 192.168.1.1                      ] │
 │ Preferred DNS:     [ 8.8.8.8                          ] │
 │                                                           │
 │                                    [ Save ]  [ Cancel ]   │
 └───────────────────────────────────────────────────────────┘
```

---

### 2. Master PC Launcher Interface (`start-master-server.bat`)

```text
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │  Hotel & Restaurant Local Master Server Initializer                         │
 ├─────────────────────────────────────────────────────────────────────────────┤
 │                                                                             │
 │ [INFO] Local Master Server Started!                                         │
 │                                                                             │
 │ [LAN NETWORK IP FOR ALL STAFF DEVICES]:                                     │
 │  >>> http://192.168.1.100:3000 <<<                                          │
 │                                                                             │
 │  Status: 100% Offline Mode Active (Zero Delay)                              │
 │  Cloud Sync: Standing by for WAN Internet                                   │
 │                                                                             │
 └─────────────────────────────────────────────────────────────────────────────┘
```

---

### 3. Staff Mobile Phone Connection Screen

```text
 Mobile Browser Screen (Chrome / Safari):
 ┌────────────────────────────────────────┐
 │ 🔒 http://192.168.1.100:3000      [⋮]  │
 ├────────────────────────────────────────┤
 │  🟢 LAN 100% Active | ☁️ Cloud Ready    │
 │                                        │
 │  🏨 HOTEL SUITE PRO                    │
 │                                        │
 │  [ 🛒 Point of Sale (POS)          ]   │
 │  [ 🛏️ Room Check-ins & Bookings   ]   │
 │  [ 🍳 Kitchen Display (KOT)        ]   │
 │  [ 🧺 Laundry Management           ]   │
 │                                        │
 └────────────────────────────────────────┘
```

---

## 📦 Software Checklist for Beginners

1. **Node.js (v18 or v20 LTS)**: [Download Node.js](https://nodejs.org/)
2. **Git**: [Download Git](https://git-scm.com/downloads)
3. **pnpm Package Manager**: `npm install -g pnpm`

---

## 🚀 Quick Setup Commands

```bash
# 1. Clone project onto Master PC
git clone https://github.com/imageuploade133-cmyk/v9-Hotel-Suite-pro-Offline.git
cd v9-Hotel-Suite-pro-Offline

# 2. Install dependencies
pnpm install

# 3. Build project
pnpm build

# 4. Launch Master Server
# Double-click start-master-server.bat (Windows) or ./start-master-server.sh (Mac/Linux)
```

---

## 📖 Complete Documentation

- `OFFLINE_LAN_SYNC_GUIDE.md` - Complete offline LAN architecture guide.
- `WHATSAPP_QUICKSTART.md` - WhatsApp messaging setup guide.

---

## 📄 License & Status

**Version**: 9.0
**Status**: ✅ 100% Offline LAN & Production Ready
