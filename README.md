# 🌱 Greener

<div align="center">
  <img src="https://readme-typing-svg.herokuapp.com?font=Fira+Code&weight=600&size=50&duration=4000&pause=1000&color=00B04F&background=FFFFFF&center=true&vCenter=true&width=800&height=100&lines=GREENER;Sustainable+Marketplace;Eco-Friendly+Commerce" alt="Greener - Sustainable Marketplace Platform" />
</div>

<div align="center">
  <img src="https://img.shields.io/github/stars/danielsddd/Greener?style=for-the-badge&logo=github&logoColor=white&color=00B04F&labelColor=2F2F2F" alt="GitHub stars"/>
  <img src="https://img.shields.io/github/forks/danielsddd/Greener?style=for-the-badge&logo=github&logoColor=white&color=00B04F&labelColor=2F2F2F" alt="GitHub forks"/>
  <img src="https://img.shields.io/github/issues/danielsddd/Greener?style=for-the-badge&logo=github&logoColor=white&color=00B04F&labelColor=2F2F2F" alt="GitHub issues"/>
  <img src="https://img.shields.io/github/license/danielsddd/Greener?style=for-the-badge&logo=github&logoColor=white&color=00B04F&labelColor=2F2F2F" alt="GitHub license"/>
</div>

<div align="center">
  <h3>🌍 The Modern Marketplace for Sustainable Living</h3>
  <p><strong>Connecting eco-conscious consumers and businesses through technology</strong></p>
</div>

---

## 🎯 Overview

**Greener** is a full-featured, cloud-native platform for sustainable commerce, connecting individuals and businesses around plants, eco-products, and green services. The app supports both consumer and business personas, offering a rich set of features for each, including marketplace, inventory, business analytics, plant care, and real-time communication.

---

## 🏗️ Architecture

### System Overview

```
┌───────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ React Native  │    │  Azure Static   │    │ Azure Functions │
│ Frontend      │◄──►│  Web Apps       │◄──►│   (Backend)     │
└───────────────┘    └─────────────────┘    └─────────────────┘
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Custom Auth   │    │  Azure SignalR  │    │ Azure Cosmos DB │
│ (Hash Storage)│    │  (Real-time)    │    │   (Database)    │
└───────────────┘    └─────────────────┘    └─────────────────┘
```

### Technology Stack

<div align="center">
  <img src="https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB"/>
  <img src="https://img.shields.io/badge/Azure_Functions-0062AD?style=for-the-badge&logo=azure-functions&logoColor=white"/>
  <img src="https://img.shields.io/badge/Azure_Cosmos_DB-4DB33D?style=for-the-badge&logo=azure-cosmos-db&logoColor=white"/>
  <img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white"/>
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white"/>
  <img src="https://img.shields.io/badge/Custom_Auth-4CAF50?style=for-the-badge&logo=key&logoColor=white"/>
  <img src="https://img.shields.io/badge/SignalR-0082C9?style=for-the-badge&logo=signalr&logoColor=white"/>
  <img src="https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=github-actions&logoColor=white"/>
</div>

---

## 🌟 Core Features

### 🏠 Home Experience

#### For Consumers:
- **Personalized Home Screen**: Quick access to marketplace, favorites, plant care, and community.
- **Plant Care Assistant**: AI-powered plant care chat, watering reminders, and plant health tips.
- **My Plants**: Manage your own plant collection, add new plants, track care schedules, and get tailored advice.
- **Favorites & Wishlist**: Save favorite products, plants, and sellers for easy access.
- **Community Forum**: Participate in plant care discussions, ask questions, and share tips.

#### For Businesses:
- **Business Welcome Screen**: Onboarding for new businesses, with clear navigation to sign up, sign in, or switch persona.
- **Business Dashboard**: Real-time KPIs, sales analytics, inventory status, and order management.
- **Inventory Management**: Add, edit, and track products, manage stock, and publish to the marketplace.
- **Customer Management**: View customer profiles, order history, and respond to reviews.
- **Business Insights**: Visual dashboards for sales, top products, customer segmentation, and revenue trends.

### 🛒 Marketplace
- **Product Discovery**: Advanced search, filtering, and categorization for plants and eco-products.
- **Seller Profiles**: Individual and business storefronts with branding, product showcases, and reviews.
- **Product Listings**: Detailed product pages with images, descriptions, pricing, and seller info.
- **Order Management**: Cart, checkout, payment, order tracking, and history.
- **Review System**: Rate and review products, sellers, and buyers.

### 🌱 Plant Management
- **Add/Edit Plants**: Users can add their own plants, upload images, and track care.
- **Plant Details**: Scientific and common names, care instructions, watering/fertilizing schedules, and origin.
- **Plant Inventory (Business)**: Businesses can manage large inventories, bulk upload, and publish to marketplace.

### 📈 Business Intelligence
- **Sales Analytics**: Real-time sales data, trends, and KPIs.
- **Inventory Reports**: Stock levels, automated alerts, and reorder suggestions.
- **Customer Insights**: Analyze customer behavior, segment users, and target marketing.
- **Revenue Dashboards**: Financial overviews, profit/loss, and market trends.

### 💬 Real-time Communication
- **Instant Messaging**: Live chat between buyers and sellers, with message history and notifications.
- **Push Notifications**: Real-time alerts for orders, messages, reviews, and system updates.
- **Community Engagement**: Forums, Q&A, and social features for plant lovers.

### 🔐 Security & Data Management
- **Custom Authentication**: Secure password hashing, salt-based encryption, and session management.
- **Role-based Access**: Permissions for consumers, business users, and admins.
- **Data Protection**: Secure storage in Azure Cosmos DB with encryption at rest.

---

## 📚 Code Structure

### Frontend

- **App.js**: App entry point, navigation, theming, and context providers.
- **/screens/**: All main screens (Marketplace, Profile, Home, Business, Registration, Login, Plant Care, Forum, etc.).
- **/components/**: Reusable UI elements (KPI widgets, charts, product cards, chat bubbles, etc.).
- **/services/**: API abstraction for backend communication (marketplace, business, plant care, maps, etc.).
- **/context/**: Global state management (forms, authentication, business logic).
- **/Business/**: Business-specific screens and services.
- **/marketplace/**: Marketplace screens, navigation, and services.

### Backend

- **Azure Functions**: Stateless microservices for user, marketplace, business, order, chat, and analytics.
- **Cosmos DB**: NoSQL database for users, products, orders, reviews, and chat.
- **SignalR**: Real-time messaging and notifications.
- **Authentication**: Custom auth with secure storage and Azure AD B2C integration.

---

## 🚀 Quick Start

### Prerequisites

```bash
Node.js >= 16.0.0
npm >= 8.0.0
Python >= 3.9.0
Azure CLI >= 2.0.0
```

### Local Development

```bash
git clone https://github.com/danielsddd/Greener.git
cd Greener
npm install
npm run dev
# Optional: Start backend locally
cd backend && func start
```

### Production Deployment

```bash
# Deploy to Azure Static Web Apps
az staticwebapp create \
  --name greener-app \
  --resource-group greener-rg \
  --source https://github.com/danielsddd/Greener

# Deploy Azure Functions
func azure functionapp publish greener-functions
```

---

## 🏆 Roadmap

- **Marketplace Expansion**: More categories, advanced filters, and business storefronts.
- **AI Plant Care**: Smarter plant care assistant and automated reminders.
- **Business Tools**: Loyalty programs, marketing automation, and advanced analytics.
- **Mobile Enhancements**: Push notifications, offline support, and camera integration.
- **Community Growth**: Enhanced forums, Q&A, and social features.

---

## 🤝 Contributing

We welcome contributions from the community!

1. 🍴 Fork the repository
2. 🌿 Create a feature branch (`git checkout -b feature/amazing-feature`)
3. 💾 Commit your changes (`git commit -m 'Add amazing feature'`)
4. 📤 Push to the branch (`git push origin feature/amazing-feature`)
5. 🔁 Open a Pull Request

Please follow our code style, write tests, and update documentation as needed.

---

## 📄 License

Greener 2025

---

## 🙏 Acknowledgments

- Daniel Simanovsky
- Dina Simanovsky
- Ilana

---

<div align="center">
  <strong>⭐ Star this repository if you believe in sustainable commerce!</strong>
  <br/><br/>
  <a href="https://github.com/danielsddd/Greener">
    <img src="https://img.shields.io/badge/View%20on-GitHub-black?style=for-the-badge&logo=github" alt="View
