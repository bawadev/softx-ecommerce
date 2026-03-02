# Ecom 🏭

**Branded Clothing at Stock Prices**

A modern e-commerce platform built with Next.js, TypeScript, Neo4j, and Tailwind CSS. Ecom offers premium branded clothing at wholesale prices with intelligent recommendations and personalized shopping experiences.

---

## 🎯 Project Vision

Ecom disrupts traditional retail by offering customers direct access to branded clothing at stock/wholesale prices. The platform leverages graph database technology (Neo4j) to provide smart recommendations based on user preferences, measurements, and shopping behavior.

---

## ✨ Key Features

### Current (v0.1)
- ✅ Modern, responsive UI with mobile-first design
- ✅ User authentication (signup/login)
- ✅ Beautiful design system with custom color palette
- ✅ Next.js 15 with App Router
- ✅ TypeScript for type safety
- ✅ Tailwind CSS for styling

### Planned
- 🔄 Product catalog with advanced filtering
- 📦 Shopping cart with real-time updates
- 🛒 Simple order placement system
- 👔 User measurements for size recommendations
- 🎯 Intelligent recommendation engine
- 🔐 Admin panel for inventory management
- 📊 Customer tracking and analytics
- ⚡ Micro-interactions and smooth animations

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker Desktop (for Neo4j and MinIO)
- npm or yarn

### One-Command Setup (Recommended) ⚡

Use the automated setup script to manage everything:

```bash
# 1. Clone and install
git clone <your-repo>
cd softx-ecommerce
npm install

# 2. Copy environment variables
cp .env.example .env.local

# 3. Start everything!
./setup.sh start
```

That's it! The script will:
- ✅ Start Neo4j & MinIO containers
- ✅ Detect empty database and offer to initialize
- ✅ Create test users automatically
- ✅ Optionally setup category hierarchy (Ladies/Gents/Kids)
- ✅ Start Next.js dev server
- ✅ Show all service URLs and credentials

**Open http://localhost:3000** 🎉

### Setup Script Commands

The `./setup.sh` script is your central control panel for managing the entire Ecom infrastructure:

```bash
# Service Management
./setup.sh start              # Start all services (auto-detects empty DB)
./setup.sh stop               # Stop all services (data preserved)
./setup.sh restart            # Restart all services
./setup.sh status             # Show detailed service status

# Monitoring & Logs
./setup.sh logs nextjs        # View Next.js development logs
./setup.sh logs neo4j         # View Neo4j database logs
./setup.sh logs minio         # View MinIO storage logs
./setup.sh health             # Run health check on all services

# Reset Commands
./setup.sh reset soft         # Restart services & clean cache (keeps data)
./setup.sh reset hard         # Delete ALL data & volumes (requires 'yes')

# Backup & Recovery
./setup.sh backup all         # Backup both Neo4j and MinIO
./setup.sh backup neo4j       # Backup database only
./setup.sh backup minio       # Backup image storage only

# Volume Management
./setup.sh volumes            # Show Docker volume info & disk usage

# Help
./setup.sh help               # Show all available commands
```

**Why use setup.sh?**
- ✅ Automatic empty database detection
- ✅ Interactive prompts for initialization
- ✅ Shows all credentials on startup
- ✅ Health checks before starting services
- ✅ Colored output for easy reading
- ✅ One command for everything

### Reset Commands Explained

**Soft Reset** (`./setup.sh reset soft`):
- Restarts all services (Neo4j, MinIO, Next.js)
- Cleans Next.js build cache (`.next` directory)
- **Preserves all data** (users, products, orders, images)
- Use when: Next.js has issues, need fresh start without data loss

**Hard Reset** (`./setup.sh reset hard`):
- Stops all services
- **Deletes ALL Docker volumes** (database + images)
- **PERMANENTLY REMOVES** all users, products, orders, images
- Requires typing "yes" to confirm
- Offers to reinitialize database after cleanup
- Use when: Starting completely fresh, testing from scratch
- **⚠️ WARNING:** This cannot be undone!

### Test Accounts (Auto-Created)

| Account | Email | Password |
|---------|-------|----------|
| Admin | `testadmin@ecommerce.com` | `Admin123!` |
| Customer | `test@example.com` | `Customer123!` |

**Service URLs:**
- Ecom: http://localhost:3000
- Neo4j Browser: http://localhost:7474 (`neo4j` / `ecommerce123`)
- MinIO Console: http://localhost:9001 (`ecommerce` / `ecommerce123`)

### Manual Setup (Alternative)

If you prefer manual control:

```bash
# 1. Start infrastructure
docker compose up -d

# 2. Initialize database schema
npm run db:init

# 3. Seed test users
npm run db:seed

# 4. Start Next.js
npm run dev
```

**Note:** Using `./setup.sh` is recommended as it handles everything automatically!

---

## 📚 Documentation

### Core Documentation

- **[README.md](./README.md)** (this file) - Project overview and quick start guide
- **[INFRASTRUCTURE.md](./INFRASTRUCTURE.md)** - Complete infrastructure and data persistence guide
- **[USER_LOGIN_GUIDE.md](./USER_LOGIN_GUIDE.md)** - Login credentials for all services
- **[CLAUDE.md](./CLAUDE.md)** - Developer guide for AI assistants

### Quick Links

| What do you need? | Read this |
|-------------------|-----------|
| 🚀 Get started quickly | This README (you're here!) |
| 🔧 Understand Docker volumes & persistence | [INFRASTRUCTURE.md](./INFRASTRUCTURE.md) |
| 🔐 Login credentials | [USER_LOGIN_GUIDE.md](./USER_LOGIN_GUIDE.md) |
| 💾 Backup and recovery | [INFRASTRUCTURE.md](./INFRASTRUCTURE.md#backup-and-recovery) |
| 🐛 Troubleshooting | [INFRASTRUCTURE.md](./INFRASTRUCTURE.md#troubleshooting) |
| 🤖 AI development | [CLAUDE.md](./CLAUDE.md) |

### Database Management

```bash
# Automated setup (recommended)
./setup.sh start          # Start all services with auto-detection

# Manual database operations
npm run db:init           # Initialize schema
npm run db:seed           # Create test users
npm run db:clear          # Reset database

# Category Setup
npm run setup:categories  # Setup Ladies/Gents/Kids category hierarchy
                          # Creates ~86 categories organized by:
                          # - Ladies: Tops, Bottoms, Dresses, Footwear, etc.
                          # - Gents: Tops, Bottoms, Formal Wear, Footwear, etc.
                          # - Kids: Boys, Girls, Footwear, Accessories

# Backup and restore
./setup.sh backup all     # Backup everything
./setup.sh backup neo4j   # Backup database only
./setup.sh backup minio   # Backup storage only
```

---

## 🛠 Tech Stack

### Frontend
- **Framework:** Next.js 15.1.4 (App Router)
- **Language:** TypeScript 5.7
- **Styling:** Tailwind CSS 3.4
- **Animations:** Framer Motion 11.15
- **Icons:** Lucide React

### Backend
- **Database:** Neo4j 5.26 (Graph Database)
- **API:** Next.js Server Actions
- **Auth:** JWT + bcrypt
- **File Storage:** Local (with migration path to cloud)

### Development
- **Package Manager:** npm
- **Linting:** ESLint
- **Testing:** Playwright MCP
- **TypeScript Execution:** tsx

---

## 📁 Project Structure

```
softx-ecommerce/
├── src/
│   ├── app/                  # Next.js pages
│   │   ├── page.tsx         # Homepage
│   │   ├── login/           # Login page
│   │   ├── signup/          # Signup page
│   │   ├── shop/            # Product catalog
│   │   ├── admin/           # Admin panel
│   │   └── actions/         # Server actions
│   ├── components/          # React components
│   │   └── ui/              # Reusable UI components
│   └── lib/                 # Utilities & core logic
│       ├── db.ts            # Neo4j driver
│       ├── auth.ts          # Authentication
│       ├── types.ts         # TypeScript types
│       └── repositories/    # Database operations
├── scripts/                 # Database scripts
├── public/                  # Static assets
├── .env.local              # Environment variables
└── package.json            # Dependencies
```

---

## 🎨 Design System

### Color Palette
- **Primary:** Navy Blue (#2d6394)
- **Accent:** Gold (#e5c158) - for "stock price" highlights
- **CTA:** Coral (#ff6b6b) - for call-to-action buttons
- **Neutral:** Gray scale

### Typography
- **Font:** Inter
- **Scale:** Responsive with mobile-first approach

### Components
- Buttons (Primary, Secondary, Ghost)
- Inputs with validation
- Cards with hover effects
- Modals and dialogs
- Loading states
- Micro-interactions

---

## 🗄 Database Schema

Ecom uses **Neo4j**, a graph database, to model complex relationships:

- **Nodes:** User, Product, ProductVariant, Order, Cart, Preferences, Measurements
- **Relationships:** Purchases, Views, Recommendations, Inventory

This enables powerful features like:
- "Users who bought this also bought..."
- Size recommendations based on measurements
- Personalized product suggestions
- Shopping pattern analysis

---

## 🔐 Authentication

- Email/password authentication
- JWT tokens stored in httpOnly cookies
- Role-based access (Customer, Admin)
- Password strength validation
- Secure session management

---

## 📱 Mobile-First Design

Ecom is built mobile-first with these breakpoints:
- Mobile: < 640px (1 column)
- Tablet: 640px - 1024px (2 columns)
- Desktop: > 1024px (4 columns)

---

## 🧪 Testing

We use Playwright MCP for end-to-end testing:
- Visual regression testing
- User flow testing
- Cross-browser compatibility
- Accessibility testing

---

## 🚧 Development Roadmap

### Phase 1: Foundation ✅
- [x] Project setup
- [x] Design system
- [x] Authentication
- [x] Database schema

### Phase 2: Core Features 🔄
- [ ] Product catalog
- [ ] Shopping cart
- [ ] Order placement
- [ ] Admin panel

### Phase 3: Personalization
- [ ] User measurements
- [ ] Preferences
- [ ] Recommendation engine

### Phase 4: Polish
- [ ] Animations
- [ ] Micro-interactions
- [ ] Performance optimization
- [ ] Accessibility improvements

---

## 📦 NPM Scripts

```bash
# Development
npm run dev          # Start Next.js dev server
npm run build        # Create production build
npm run start        # Start production server
npm run lint         # Run ESLint

# Database Management
npm run db:init      # Initialize Neo4j schema (constraints & indexes)
npm run db:seed      # Seed test users (admin & customer)
npm run db:clear     # Clear all database data (with confirmation)

# Categories & Filters
npm run setup:categories  # Setup category hierarchy
npm run filters:init      # Initialize custom filter system
npm run filters:validate  # Validate filter relationships

# MinIO Setup
npm run minio:init   # Initialize MinIO bucket
```

**Tip:** Use `./setup.sh start` instead of manual npm commands!

---

## 🌐 Environment Variables

```env
# Neo4j Database
NEO4J_URI=neo4j://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password

# Authentication
JWT_SECRET=your-secret-key

# Application
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 🤝 Contributing

This is currently a solo development project, but contributions are welcome! Please ensure:
- Code follows TypeScript best practices
- Components match the design system
- All tests pass
- Documentation is updated

---

## 📄 License

Private project - All rights reserved.

---

## 🎯 Key Differentiators

1. **Stock Prices:** Direct access to wholesale pricing
2. **Graph Database:** Sophisticated relationship modeling for better recommendations
3. **Measurements:** Size recommendations based on actual measurements
4. **Modern Stack:** Latest Next.js, React, and TypeScript
5. **Mobile-First:** Optimized for mobile shopping experience
6. **Spec-Driven:** Comprehensive documentation and planning

---

## 📞 Support

For setup issues, see [INFRASTRUCTURE.md](./INFRASTRUCTURE.md) or check:
- Neo4j connection troubleshooting
- Environment variable configuration
- Port conflicts resolution

---

## 🏗 Built With

- ❤️ Love for clean code
- ☕ Lots of coffee
- 🎨 Attention to design details
- 📐 Spec-driven development
- 🧪 Test-driven iteration

---

**Ecom** - Where premium meets affordable.
