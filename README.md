<p align="center">
  <img src="assets/images/repairconnectglasslogo.png" alt="OtoPair Logo" width="120" height="200" />
</p>

<h1 align="center">OtoPair</h1>

<p align="center">
  <strong>Your trusted companion for seamless auto repair connections</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#project-structure">Structure</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## 🚗 What is OtoPair?

**OtoPair** is a modern mobile application that bridges the gap between car owners and trusted auto repair professionals. Whether you need a quick oil change, major repairs, or routine maintenance, OtoPair connects you with verified mechanics and service centers in your area.

No more endless phone calls, confusing quotes, or uncertainty about repair quality. OtoPair streamlines the entire process—from finding the right mechanic to booking appointments and tracking your vehicle's service history.

## ✨ Features

### For Car Owners
- **🔍 Find Nearby Services** — Discover trusted mechanics and service centers based on your location
- **📅 Easy Booking** — Schedule appointments with just a few taps
- **🚙 Vehicle Management** — Keep track of all your vehicles in one place
- **📋 Service History** — Access complete maintenance records anytime
- **⭐ Reviews & Ratings** — Make informed decisions with real customer feedback
- **💬 Direct Communication** — Chat with service providers before booking

### For Service Providers
- **📊 Manage Bookings** — Streamline your appointment schedule
- **👥 Customer Insights** — Build lasting relationships with car owners
- **📈 Grow Your Business** — Expand your reach and attract new customers

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Expo CLI
- iOS Simulator / Android Emulator (or Expo Go app)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/AppFlowStudios/otopair.git
   cd otopair
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npx expo start
   ```

4. **Run on your device**
   - Scan the QR code with [Expo Go](https://expo.dev/go) (iOS/Android)
   - Press `i` for iOS Simulator
   - Press `a` for Android Emulator

## 🛠 Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | React Native + Expo |
| **Navigation** | Expo Router (file-based) |
| **Styling** | Custom Design System |
| **Typography** | Urbanist Font Family |
| **Icons** | Custom SVG Icons |
| **State Management** | React Hooks |

## 📁 Project Structure

```
otopair/
├── app/                      # App screens (file-based routing)
│   ├── (main-tabs)/          # Main tab navigation
│   │   ├── home/             # Home screen
│   │   ├── bookings/         # Bookings management
│   │   ├── cars/             # Vehicle management
│   │   └── settings/         # User settings
│   └── (onboarding)/         # Onboarding flow
├── components/
|   ├── onboarding/ 
|   ├── home/ 
|   ├── bookings/ 
|   ├── cars/ 
|   ├── settings/ 
│   ├── shared-ui/            # Foundational UI components
│   │   ├── Button.tsx        # Primary, Secondary, Ghost buttons
│   │   ├── Text.tsx          # Typography with Urbanist font
│   │   ├── Container.tsx     # Layout wrappers
│   │   └── Input.tsx         # Form inputs
│   └── icons/                # Custom SVG icons
├── constants/
│   └── theme.ts              # Colors, typography, spacing
├── hooks/                    # Custom React hooks
└── assets/
    ├── fonts/                # Urbanist font files
    └── images/               # App icons and images
    |   ├── onboarding/ 
    |   ├── home/ 
    |   ├── bookings/ 
    |   ├── cars/ 
    |   ├── settings/ 
```

## 🎨 Design System

OtoPair uses a custom design system built for consistency and developer experience:

### Colors
| Name | Hex | Usage |
|------|-----|-------|
| **Primary** | `#141C24` | Buttons, headers |
| **Secondary** | `#5299FE` | Accents, links |
| **White** | `#FFFFFF` | Backgrounds, text |

### Typography
All text uses the **Urbanist** font family with weights from Light (300) to ExtraBold (800).

### Components
Import from the shared-ui library:
```tsx
import { Button, Text, Container, Input } from '@/components/shared-ui';
```

## 🤝 Contributing

We welcome contributions! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is proprietary software owned by AppFlow Studios.

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/AppFlowStudios">AppFlow Studios</a>
</p>
