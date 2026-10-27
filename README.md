# Hotel Suite Pro

A comprehensive hotel/property management web application built with Next.js 14, React 18, TypeScript, and Firebase.

## 🚀 Recent Updates

### WhatsApp Messaging Fix (Feb 7, 2026)

Fixed critical issue where WhatsApp messages showed "successfully sent" but weren't actually being delivered.

**Quick Setup:**
1. See [WHATSAPP_QUICKSTART.md](./WHATSAPP_QUICKSTART.md) for 5-minute setup
2. Read [WHATSAPP_FIX_SUMMARY.md](./WHATSAPP_FIX_SUMMARY.md) for technical details

**Your Credentials:**
- Username: `electro1@emakemrnd.com.ng`
- API Key: `4e72ff9e21f1e875834598daeacfd997a892bca332fce1a90804cb15ca2da398`

Add these in **Settings → Page 2 → EbulkSMS Settings**

## 📋 Features

- **Hotel Operations**: Bookings, reservations, check-ins, room management
- **POS & Sales**: Point of sale, product sales, inventory management
- **Services**: Restaurant, kitchen, laundry, gym, barbing salon
- **Finance**: Payments, expenses, accounting, salary, reporting
- **Guest Experience**: Public website, menus, guest bill/report, booking confirmation
- **Automation**: Daily reports, WhatsApp notifications, alerts
- **AI Features**: Image generation for menus using Google Imagen

## 🛠️ Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **UI/UX**: Tailwind CSS, Radix UI, Framer Motion, lucide-react icons
- **Backend**: Firebase (Firestore, Auth), Next.js API Routes
- **AI**: Genkit with Google Gemini & Imagen
- **Integrations**: eBulkSMS WhatsApp API

## 📂 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication routes
│   ├── (protected)/       # Protected app pages
│   └── (public)/          # Public-facing pages
├── components/            # React components
├── contexts/              # React contexts
├── hooks/                 # Custom hooks
├── firebase/              # Firebase setup
├── ai/                    # Genkit AI flows
└── lib/                   # Utilities and helpers
```

## 🚦 Getting Started

### Prerequisites

- Node.js 18+
- Firebase project
- Google Apps Script (for WhatsApp integration)
- eBulkSMS account (for WhatsApp messaging)

### Installation

```bash
# Clone the repository
git clone [your-repo-url]

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Firebase credentials

# Run development server
npm run dev
```

Visit `http://localhost:3000` to see your application.

## 🔧 Configuration

### 1. Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Firestore and Authentication
3. Add your Firebase config to `.env.local`

### 2. WhatsApp Messaging Setup

See [WHATSAPP_QUICKSTART.md](./WHATSAPP_QUICKSTART.md) for detailed instructions.

Quick steps:
1. Add eBulkSMS credentials in Settings → Page 2
2. Deploy Google Apps Script (see Code.gs)
3. Add script URL to Firestore
4. Test by sending a message

### 3. Google Apps Script

Deploy the `Code.gs` file as a Web App:
1. Create new project at [script.google.com](https://script.google.com)
2. Copy contents of `Code.gs`
3. Add FirestoreApp library
4. Deploy as Web App
5. Copy Web App URL to Firestore `settings/googleAppsScript`

## 📚 Documentation

- [WHATSAPP_QUICKSTART.md](./WHATSAPP_QUICKSTART.md) - Quick setup for WhatsApp messaging
- [WHATSAPP_SETUP_GUIDE.md](./WHATSAPP_SETUP_GUIDE.md) - Detailed WhatsApp configuration
- [WHATSAPP_FIX_SUMMARY.md](./WHATSAPP_FIX_SUMMARY.md) - Technical details of recent fix
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Overall implementation notes
- [TESTING_CHECKLIST.md](./TESTING_CHECKLIST.md) - Testing guidelines

## 🧪 Testing

```bash
# Run tests (if available)
npm test

# Type check
npm run type-check

# Lint
npm run lint
```

## 🚀 Deployment

This project is configured for Firebase App Hosting.

```bash
# Build for production
npm run build

# Deploy to Firebase
firebase deploy
```

## 📝 Key Features Setup

### WhatsApp Notifications
- Reservation alerts
- Transfer receipts
- Bulk messaging to customers/staff/gym members
- Status tracking and logging

### Room Management
- Real-time availability
- Housekeeping queues
- Room status (vacant/cleaning/maintenance/DND)

### POS System
- Product sales
- Credit sales
- Stock management
- Supplier management

### Guest Services
- Digital menu
- Guest bill generation
- Online booking
- Engagement features

## 🔐 Security

- Firebase Authentication for user management
- Firestore security rules (see `firestore.rules`)
- Role-based permissions
- Secure API key storage

## 🐛 Troubleshooting

### WhatsApp Messages Not Sending
1. Check credentials in Settings → Page 2
2. Verify Google Apps Script URL is configured
3. Review `whatsapp-logs` collection in Firestore
4. Check Google Apps Script execution logs

### Build Errors
- Clear `.next` folder: `rm -rf .next`
- Delete node_modules: `rm -rf node_modules && npm install`
- Check TypeScript errors: `npm run type-check`

## 📄 License

[Add your license here]

## 🤝 Contributing

[Add contribution guidelines]

## 📧 Support

For issues or questions:
1. Check the documentation in this repository
2. Review Firestore logs
3. Check Google Apps Script execution logs
4. [Add your support contact]

---

**Current Version**: 9.0
**Last Updated**: February 7, 2026
**Status**: ✅ Production Ready
