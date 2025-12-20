# 🎨 Chhapai Order Flow Tool

Complete order management system with WooCommerce integration, real-time updates, and multi-department workflow.

## ✨ Features

- **Order Management**: Complete order lifecycle from sales to dispatch
- **WooCommerce Integration**: Fetch and import orders from WooCommerce
- **Multi-Department Workflow**: Sales → Design → Prepress → Production → Dispatch
- **Real-time Updates**: Supabase Realtime for instant order visibility
- **Department Dashboards**: Design, Prepress, Production, Sales, Admin
- **User Assignment**: Assign orders to specific users or departments
- **Priority Management**: Red/Yellow/Blue priority system
- **File Management**: Upload and manage order files (proofs, finals, images)
- **Timeline Tracking**: Complete order history and activity log
- **Outsource Management**: Track outsource jobs and vendor details

## 🛠️ Tech Stack

- **Frontend**: React + TypeScript + Vite
- **UI Library**: shadcn/ui + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Realtime + Storage)
- **Authentication**: Supabase Auth
- **API Integration**: WooCommerce REST API
- **State Management**: React Context API

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- WooCommerce store (optional, for integration)

## 🚀 Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/chhapai-order-flow.git
cd chhapai-order-flow
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

Create `.env` file:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Run Database Migrations

Apply Supabase migrations in order:

```bash
# Supabase Dashboard → SQL Editor
# Run migrations from supabase/migrations/ in chronological order
```

### 5. Start Development Server

```bash
npm run dev
```

App will be available at `http://localhost:8080`

## 📁 Project Structure

```
chhapai/
├── src/
│   ├── components/     # React components
│   ├── contexts/       # React contexts (Order, Auth, etc.)
│   ├── pages/          # Page components
│   ├── services/       # API services
│   ├── types/          # TypeScript types
│   └── utils/          # Utility functions
├── supabase/
│   ├── functions/      # Supabase Edge Functions
│   └── migrations/     # Database migrations
├── public/             # Static assets
└── dist/              # Build output
```

## 🔐 Authentication

- Email/Password authentication via Supabase
- Role-based access control (Admin, Sales, Design, Prepress, Production)
- Department-based order visibility

## 📊 Database Schema

### Main Tables

- `orders` - Order information
- `order_items` - Individual items in orders
- `order_files` - File attachments
- `timeline` - Order activity log
- `profiles` - User profiles
- `user_roles` - User role assignments

### Key Features

- Row-Level Security (RLS) for data access control
- Real-time subscriptions for live updates
- Department-based visibility rules
- User assignment tracking

## 🔄 Workflow Stages

1. **Sales** - Order creation and initial setup
2. **Design** - Design work and approval
3. **Prepress** - Pre-production preparation
4. **Production** - Manufacturing/printing
5. **Outsource** - External vendor work (optional)
6. **Dispatch** - Shipping and delivery
7. **Completed** - Order fulfillment

## 🛡️ Security

- Row-Level Security (RLS) policies
- Department-based access control
- User assignment visibility rules
- Secure file uploads
- Environment variable protection

## 📝 Key Features

### Order Fetch from WooCommerce

- Search by Order Number, Customer Email, Name, or Phone
- Selective import of orders
- Automatic assignment to importing user
- Duplicate prevention

### Department Visibility

- Admin sees all orders
- Sales sees all orders
- Department users see all orders in their department
- Assigned orders visible to assigned user + department

### Real-time Updates

- Instant order visibility after import
- Live updates on assignment changes
- Real-time dashboard updates

## 🚀 Deployment

### Build for Production

```bash
npm run build
```

### Deploy to Vercel/Netlify

1. Connect GitHub repository
2. Set environment variables
3. Deploy automatically on push

## 📚 Documentation

- `MIGRATION_STEPS.md` - Database migration guide
- `GITHUB_PUSH_COMPLETE.md` - GitHub push instructions
- `FIXES_APPLIED.md` - Recent fixes and updates

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

Private/Proprietary - All rights reserved

## 👥 Team

- Development: Chhapai Team
- Contact: [Your Contact Info]

## 🐛 Known Issues

- Some TypeScript errors in legacy Firebase code (non-critical)
- Migration required for full functionality

## 🔮 Future Enhancements

- [ ] Mobile app
- [ ] Advanced analytics
- [ ] Email notifications
- [ ] Multi-language support
- [ ] Advanced reporting

---

**Made with ❤️ by Chhapai Team**
