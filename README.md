# Chhapai Order Management System

Production-ready order management system with role-based access control, realtime updates, and comprehensive workflow management.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Supabase account
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/chhapai.git
cd chhapai
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:
```
VITE_SUPABASE_URL=your-project-url.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

4. Run database migrations:
```bash
cd supabase
supabase db push --include-all
```

5. Start development server:
```bash
npm run dev
```

## 🔐 Security

- All sensitive data is protected by Row Level Security (RLS)
- Environment variables are never committed to Git
- Input sanitization prevents XSS attacks
- Audit logging for sensitive operations
- Production-safe logging (no console.log in builds)

## 📦 Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

Environment variables needed:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Manual Build

```bash
npm run build
```

## 🛠️ Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **UI**: Tailwind CSS + shadcn/ui
- **State**: React Context + Custom Hooks

## 📱 Features

- Role-based access control (Admin, Sales, Design, Production, etc.)
- Realtime order updates
- Push notifications
- File upload & management
- Customer management
- Payment tracking
- Workflow automation
- Reports & analytics

## 🔒 Security Features

- Row Level Security (RLS) on all tables
- Input sanitization
- XSS protection
- CSRF protection
- Audit logging
- Secure session management

## 📄 License

Proprietary - All rights reserved

## 🤝 Support

For issues or questions, contact support@chhapai.com
