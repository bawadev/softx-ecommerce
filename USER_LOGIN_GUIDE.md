# Ecom - User Login Guide

This guide explains how to access Ecom including all services, test credentials, and account creation.

## Table of Contents
- [Quick Start](#quick-start)
- [Database & Infrastructure Access](#database--infrastructure-access)
- [Test User Accounts](#test-user-accounts)
- [Creating a New Account](#creating-a-new-account)
- [Login Process](#login-process)
- [User Features](#user-features)
- [Troubleshooting](#troubleshooting)

## Quick Start

1. **Start all services:**
   ```bash
   # Recommended: Use dev.sh to start everything
   ./setup.sh start

   # Or manually:
   docker compose up -d   # Start Neo4j & MinIO
   npm run dev            # Start Next.js
   ```

2. **Verify services are running:**
   - Ecom: http://localhost:3000
   - Neo4j Browser: http://localhost:7474
   - MinIO Console: http://localhost:9001

3. **Login with test credentials:**
   - **Admin:** `testadmin@ecommerce.com` / `Admin123!`
   - **Neo4j:** `neo4j` / `ecommerce123`
   - **MinIO:** `ecommerce` / `ecommerce123`

4. **Or create a new customer account:**
   - Navigate to: http://localhost:3000/en/signup
   - Fill in the registration form
   - Auto-login after signup

---

## Remote/Production Access

### Production Ecom Application

Access the live production instance deployed on Dokploy:

| Service | URL | Username/Email | Password | Status |
|---------|-----|----------------|----------|--------|
| **Ecom Production** | https://renfy.style/en | `testadmin@ecommerce.com` | `Admin123!` | ✅ Live |
| **Admin Dashboard** | https://renfy.style/en/admin/dashboard | Same as above | Same as above | ✅ Live |

**Production URLs:**
```
Homepage:        https://renfy.style/en
Login:           https://renfy.style/en/login
Admin Panel:     https://renfy.style/en/admin/dashboard
Shop:            https://renfy.style/en/shop
```

**Important Notes:**
- ⚠️ Change the default admin password after first login to production
- Production database and images are separate from local development
- Changes made locally need to be deployed via Git push (see DOKPLOY_DEPLOYMENT.md)

### Dokploy Dashboard Access

Access the Dokploy deployment platform to manage the production application:

| Service | URL | Details | Status |
|---------|-----|---------|--------|
| **Dokploy Dashboard** | http://62.171.137.117:3000 | Deployment platform | ✅ Accessible |

**Dokploy Features:**
- Application deployment and management
- View deployment logs and status
- Manage environment variables
- Monitor application health
- Manual deployment triggers
- Service configuration (Neo4j, MinIO)

**Access Instructions:**
1. Navigate to: http://62.171.137.117:3000
2. Login with Dokploy credentials
3. Select "Ecom" project
4. Access application settings and deployments

### Production Infrastructure

**Note:** Production Neo4j and MinIO are accessed internally by the application. Direct external access is typically restricted for security.

If you need to access production database or storage:
1. SSH into the Dokploy server
2. Use Docker commands to access services
3. See DOKPLOY_DEPLOYMENT.md for detailed instructions

---

## Local Development Access

The following credentials are for local development only (localhost):

## Database & Infrastructure Access

### Neo4j Browser

Access the Neo4j graph database browser for direct database queries and visualization.

| Service | URL | Username | Password | Status |
|---------|-----|----------|----------|--------|
| **Neo4j Browser** | http://localhost:7474 | `neo4j` | `ecommerce123` | ✅ Verified |

**Connection Details:**
- Connect URL: `neo4j://localhost:7687`
- Authentication: Username / Password
- Database: `neo4j` (default)

**Common Queries:**
```cypher
// View all users
MATCH (u:User) RETURN u.email, u.role

// View all products
MATCH (p:Product) RETURN p.name, p.brand, p.price LIMIT 10

// View category hierarchy
MATCH (c:Category) WHERE c.level = 0 RETURN c.name, c.hierarchy
```

### MinIO Console

Access the MinIO object storage console for managing uploaded images and files.

| Service | URL | Access Key | Secret Key | Status |
|---------|-----|------------|------------|--------|
| **MinIO Console** | http://localhost:9001 | `ecommerce` | `ecommerce123` | ✅ Verified |

**Features:**
- Object Browser: View and manage uploaded product images
- Bucket Management: `product-images` bucket contains all product photos
- File Upload: Upload new images directly
- Access Management: Configure bucket policies

**Product Images Location:**
- Bucket: `product-images`
- URL Format: `http://localhost:9000/product-images/{filename}.webp`
- All images auto-converted to WebP format

---

## Test User Accounts

### Admin Test Account

For testing admin functionality:

| Email | Password | Role | Status |
|-------|----------|------|--------|
| `testadmin@ecommerce.com` | `Admin123!` | ADMIN | ✅ Verified Working |

**Admin Panel URL:** http://localhost:3000/en/admin/dashboard

**Admin Features:**
- **Products:** Manage product catalog, add new products, update inventory
- **Orders:** View and manage customer orders, update order status, track fulfillment
- **Inventory:** Track stock levels, view low inventory alerts, manage variants
- **Promotional Sections:** Create "Best Sellers", "New Arrivals", seasonal offers
- **Custom Filters:** Define hierarchical filters to organize products
- **Categories:** Manage Ladies/Gents/Kids category hierarchies

**Quick Stats Dashboard:**
- Total Products count
- Pending Orders count
- Low Stock Items alerts
- Total Revenue tracking

### Customer Test Account

**Recommended:** Create a new customer account for testing (see [Creating a New Account](#creating-a-new-account) below).

**Example Test Customer:**
```
Email:     test.customer@example.com
Password:  TestPass123!
```

### Other Accounts in Database

The following accounts exist but passwords are unknown (created via signup with hashed passwords):

| Email | Role | Status |
|-------|------|--------|
| `admin@ecommerce.com` | ADMIN | ⚠️ Password unknown |
| `test@example.com` | CUSTOMER | ⚠️ Password unknown |

**Note:** If you need to access these accounts, create new test accounts instead or manually reset passwords via Neo4j.

---

## Creating a New Account

### Step-by-Step Signup Process

1. **Navigate to Signup Page:**
   - URL: http://localhost:3000/en/signup
   - Or click "Sign Up" from the login page

2. **Fill in Registration Form:**
   ```
   First Name: [Your First Name]
   Last Name: [Your Last Name]
   Email: [your-email@example.com]
   Password: [Strong password]
   Phone: [Optional phone number]
   ```

3. **Password Requirements:**
   - Minimum 8 characters
   - Must include uppercase and lowercase letters
   - Must include at least one number
   - Special characters recommended (e.g., !, @, #, $)
   - Example: `Customer123!`

4. **Submit and Auto-Login:**
   - Upon successful registration, you'll be automatically logged in
   - Redirected to the homepage as an authenticated customer

### Example Test Customer Account

For testing purposes, you can create:
```
First Name: Test
Last Name: Customer
Email: test.customer@example.com
Password: TestPass123!
Phone: 555-0123 (optional)
```

---

## Login Process

### Regular Login Flow

1. **Go to Login Page:**
   ```
   http://localhost:3000/en/login
   ```

2. **Enter Credentials:**
   - Email address
   - Password

3. **Submit:**
   - Click "Login" button
   - Upon success, redirected to homepage or previous page

4. **Authentication:**
   - JWT token stored in httpOnly cookie
   - Session persists for 7 days
   - Auto-logout after token expiration

### Login via Navigation

1. Click "Login" button in top navigation
2. If accessing protected pages (cart, checkout, profile), you'll be redirected to login with return URL
3. After login, automatically redirected back to intended page

---

## User Features

Once logged in as a customer, you have access to:

### 🛍️ Shopping Features
- **Browse Products:** `/en/shop`
  - Filter by category, gender, brand
  - Search products
  - View product details

- **Product Details:** `/en/product/[id]`
  - View product images and variants
  - Select size and color
  - Add to cart
  - View size recommendations (if measurements saved)

- **Shopping Cart:** `/en/cart`
  - View cart items
  - Update quantities
  - Remove items
  - Proceed to checkout

### 📦 Order Management
- **Checkout:** `/en/checkout`
  - Enter shipping address
  - Choose delivery method (Ship or Collect)
  - Upload payment proof
  - Place order

- **Order History:** `/en/orders`
  - View all past orders
  - Track order status (Pending, Confirmed, Fulfilled, Cancelled)
  - View order details

### 👤 Profile Management
- **User Profile:** `/en/profile`
  - Update personal information
  - Set shopping preferences:
    - Preferred brands
    - Preferred colors
    - Preferred categories
    - Price range
  - Save body measurements for size recommendations:
    - Height, weight
    - Chest, waist, hips
    - Shoulders, inseam
    - Preferred size
  - Choose measurement units (Metric/Imperial)

### 🎯 Personalized Recommendations
- Based on browsing history
- Collaborative filtering (users with similar purchases)
- Content-based (matching your preferences)
- Size recommendations based on measurements

---

## Troubleshooting

### Can't Login - Invalid Credentials
- **Check email spelling** - emails are case-insensitive but must match exactly
- **Verify password** - passwords are case-sensitive
- **Check Caps Lock** is off
- **Create new account** if you've forgotten credentials

### Session Expired
- JWT tokens expire after 7 days
- Simply login again with your credentials
- Session cookie will be refreshed

### Redirected to Login Unexpectedly
- Token may have expired
- Cookie may have been cleared
- Login again to restore session

### Can't Access Admin Panel
- Customer accounts have `CUSTOMER` role by default
- Admin panel requires `ADMIN` role
- To upgrade an account to admin, use Neo4j:
  ```bash
  docker exec softx-ecommerce-neo4j cypher-shell -u neo4j -p ecommerce123 \
    "MATCH (u:User {email: 'your-email@example.com'}) SET u.role = 'ADMIN' RETURN u.email, u.role"
  ```
- Or create a script at `scripts/set-admin-role.ts` if needed

### Account Creation Fails
- **Email already exists** - use different email or login with existing account
- **Weak password** - ensure password meets requirements
- **Validation errors** - check all required fields are filled

### Database Connection Issues
```bash
# Verify Neo4j is running
docker ps

# Test database connection
npm run db:init

# Check environment variables
cat .env.local
```

---

## Difference: Customer vs Admin

| Feature | Customer | Admin |
|---------|----------|-------|
| Browse Products | ✅ | ✅ |
| Add to Cart | ✅ | ✅ |
| Place Orders | ✅ | ✅ |
| View Own Orders | ✅ | ✅ |
| Manage Profile | ✅ | ✅ |
| Admin Panel Access | ❌ | ✅ |
| Manage All Products | ❌ | ✅ |
| View All Orders | ❌ | ✅ |
| Inventory Management | ❌ | ✅ |

---

## Quick Reference

### Production/Remote Service Credentials

| Service | URL | Username/Email | Password | Status |
|---------|-----|----------------|----------|--------|
| **Ecom Production** | https://renfy.style/en/login | `testadmin@ecommerce.com` | `Admin123!` | ✅ Live |
| **Dokploy Dashboard** | http://62.171.137.117:3000 | [Your Dokploy email] | [Your Dokploy password] | ✅ Accessible |

### Local Development Service Credentials

| Service | URL | Username/Email | Password | Status |
|---------|-----|----------------|----------|--------|
| **Ecom (Admin)** | http://localhost:3000/en/login | `testadmin@ecommerce.com` | `Admin123!` | ✅ Working |
| **Neo4j Browser** | http://localhost:7474 | `neo4j` | `ecommerce123` | ✅ Working |
| **MinIO Console** | http://localhost:9001 | `ecommerce` | `ecommerce123` | ✅ Working |

### Customer URLs
```
Homepage:        http://localhost:3000/en
Login:           http://localhost:3000/en/login
Signup:          http://localhost:3000/en/signup
Shop:            http://localhost:3000/en/shop
Cart:            http://localhost:3000/en/cart
Checkout:        http://localhost:3000/en/checkout
Orders:          http://localhost:3000/en/orders
Profile:         http://localhost:3000/en/profile
```

### Admin URLs
```
Dashboard:       http://localhost:3000/en/admin/dashboard
Products:        http://localhost:3000/en/admin/products
Orders:          http://localhost:3000/en/admin/orders
Inventory:       http://localhost:3000/en/admin/inventory
Categories:      http://localhost:3000/en/admin/categories
Filters:         http://localhost:3000/en/admin/filters
Promo Sections:  http://localhost:3000/en/admin/sections
```

### Infrastructure URLs
```
Neo4j Browser:   http://localhost:7474
Neo4j Bolt:      neo4j://localhost:7687
MinIO Console:   http://localhost:9001
MinIO API:       http://localhost:9000
```

### Recommended Test Workflow

1. **Create Test Account:**
   ```
   Email: test.customer@example.com
   Password: TestPass123!
   ```

2. **Browse and Shop:**
   - Go to `/en/shop`
   - Add items to cart
   - Checkout with test address

3. **Set Preferences:**
   - Go to `/en/profile`
   - Set brand preferences (e.g., Nike, Ralph Lauren)
   - Set color preferences (e.g., Blue, Black)
   - Add measurements for size recommendations

4. **View Recommendations:**
   - Browse products with similar preferences
   - See personalized recommendations on homepage

---

## Support

For issues or questions:
- Check [INFRASTRUCTURE.md](./INFRASTRUCTURE.md) for environment setup and troubleshooting
- Check [CLAUDE.md](./CLAUDE.md) for technical architecture details
- Review server actions in `src/app/actions/auth.ts`

## Related Documentation
- [INFRASTRUCTURE.md](./INFRASTRUCTURE.md) - Infrastructure and data persistence guide
- [README.md](./README.md) - Project overview and quick start
- [CLAUDE.md](./CLAUDE.md) - Developer guide for AI assistants
