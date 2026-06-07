# Logistics - Delivery Coordination App

A real-time local logistics and delivery coordination web app. Built with plain HTML/CSS/JS and Firebase.

## Features

- **Authentication**: Email/password signup with role selection (Customer or Trader)
- **Customer**: Create delivery orders, track status in real time, view rider details, cancel pending orders
- **Trader**: View live pending orders feed, accept orders (atomic transactions prevent double-accept), update status (Picked Up → In Transit → Delivered), share GPS location
- **Live Map Tracking**: Full-screen Leaflet.js map showing the trader's current position during "In Transit" status
- **Real-time Sync**: All data syncs instantly via Firestore `onSnapshot` listeners

## Project Structure

```
├── index.html              # SPA shell with all pages
├── css/style.css           # All styles
├── js/
│   ├── config.js           # Firebase configuration
│   ├── router.js           # Hash-based SPA router
│   ├── auth.js             # Authentication logic
│   ├── customer.js         # Customer dashboard & orders
│   ├── trader.js           # Trader dashboard & order management
│   └── app.js              # App initialization & form handlers
├── firebase.json           # Firebase Hosting configuration
├── firestore.rules         # Firestore security rules
├── firestore.indexes.json  # Firestore composite indexes
└── storage.rules           # Cloud Storage security rules
```

## Setup

### 1. Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project (or use existing `logistics-32d01`)
3. Enable **Authentication** → Sign-in method → **Email/Password**
4. Enable **Cloud Firestore** → Create database (start in test mode, then apply rules)
5. Enable **Cloud Storage** (optional, for proof-of-delivery photos)

### 2. Firebase Config

Open `js/config.js` and verify the Firebase config object. Update if using a different project.

### 3. Firestore Indexes

The app requires composite indexes for real-time queries. Deploy them:

```bash
firebase deploy --only firestore:indexes
```

Or create them manually in the Firebase Console:
- `orders` collection: `status` ASC, `createdAt` DESC
- `orders` collection: `customerId` ASC, `createdAt` DESC
- `orders` collection: `traderId` ASC, `status` ASC
- `orders` collection: `traderId` ASC, `status` ASC, `createdAt` DESC

### 4. Firestore Security Rules

Deploy the security rules:

```bash
firebase deploy --only firestore:rules
```

### 5. Run Locally

Just open `index.html` in a browser, or use a local server:

```bash
npx serve .
```

### 6. Deploy to Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase init hosting  # select existing project
firebase deploy --only hosting
```

## Usage

### Customer
1. Sign up as a **Customer**
2. Create a delivery order (pickup/drop-off addresses, package description, phone)
3. View your orders in the right panel — status updates in real time
4. Once a trader accepts and marks "In Transit", click **Live Track** for real-time map tracking
5. Cancel orders before a trader accepts them

### Trader
1. Sign up as a **Trader**
2. View all **Pending Orders** — they appear/disappear in real time as customers create and traders accept
3. Click **Accept** on an order — it's atomically assigned to you
4. Update status: Picked Up → In Transit → Delivered
5. During "In Transit", click **Share Location** to broadcast GPS position to the customer
6. View completed deliveries in the **History** tab

## Firebase Services Used

| Service | Purpose |
|---------|---------|
| Firebase Authentication | Email/password login, role-based access |
| Cloud Firestore | Real-time order data, user profiles, location sharing |
| Cloud Storage | (Optional) Delivery proof photos |
| Firebase Hosting | Static site deployment |
