import { Order, TimelineEntry, User, Priority, Stage } from '@/types/order';

// Helper to compute priority based on days until delivery
export const computePriority = (deliveryDate: Date): Priority => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const delivery = new Date(deliveryDate);
  delivery.setHours(0, 0, 0, 0);
  const daysUntil = Math.ceil((delivery.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntil > 5) return 'blue';
  if (daysUntil >= 3) return 'yellow';
  return 'red';
};

// Mock Users
export const mockUsers: User[] = [
  {
    user_id: 'u1',
    name: 'Rajesh Kumar',
    email: 'rajesh@chhapai.com',
    phone: '+91 98765 43210',
    roles: ['sales', 'admin'],
    team: 'Sales',
  },
  {
    user_id: 'u2',
    name: 'Priya Sharma',
    email: 'priya@chhapai.com',
    roles: ['design'],
    team: 'Design',
  },
  {
    user_id: 'u3',
    name: 'Amit Patel',
    email: 'amit@chhapai.com',
    roles: ['prepress'],
    team: 'Prepress',
  },
  {
    user_id: 'u4',
    name: 'Suresh Reddy',
    email: 'suresh@chhapai.com',
    roles: ['production'],
    team: 'Production',
  },
];

// Current user (for demo)
export const currentUser = mockUsers[0];

// Mock Orders
export const mockOrders: Order[] = [
  {
    order_id: 'ORD-2024-001',
    source: 'wordpress',
    customer: {
      name: 'Sharma Enterprises',
      phone: '+91 98765 12345',
      email: 'orders@sharmaent.com',
      address: '123 MG Road, Mumbai 400001',
    },
    created_by: 'u1',
    created_at: new Date('2024-12-05'),
    updated_at: new Date('2024-12-09'),
    global_notes: 'Premium client - handle with care',
    is_completed: false,
    order_level_delivery_date: new Date('2024-12-15'),
    priority_computed: 'blue',
    items: [
      {
        item_id: 'item-001-1',
        order_id: 'ORD-2024-001',
        product_name: 'Business Cards - Matte Finish',
        sku: 'BC-MAT-500',
        quantity: 500,
        specifications: {
          paper: '350 GSM Art Card',
          size: '3.5" x 2"',
          finishing: 'Matte Lamination + Spot UV',
          notes: 'Gold foiling on logo',
        },
        need_design: true,
        current_stage: 'design',
        current_substage: null,
        assigned_to: 'u2',
        assigned_department: 'design',
        delivery_date: new Date('2024-12-15'),
        priority_computed: 'blue',
        files: [],
        is_ready_for_production: false,
        is_dispatched: false,
        created_at: new Date('2024-12-05'),
        updated_at: new Date('2024-12-09'),
      },
      {
        item_id: 'item-001-2',
        order_id: 'ORD-2024-001',
        product_name: 'Letterheads',
        sku: 'LH-100',
        quantity: 1000,
        specifications: {
          paper: '100 GSM Bond',
          size: 'A4',
          finishing: 'None',
        },
        need_design: false,
        current_stage: 'prepress',
        current_substage: null,
        assigned_to: 'u3',
        assigned_department: 'prepress',
        delivery_date: new Date('2024-12-15'),
        priority_computed: 'blue',
        files: [],
        is_ready_for_production: false,
        is_dispatched: false,
        created_at: new Date('2024-12-05'),
        updated_at: new Date('2024-12-08'),
      },
    ],
    meta: {
      wp_order_id: 1234,
      imported: true,
    },
  },
  {
    order_id: 'ORD-2024-002',
    source: 'manual',
    customer: {
      name: 'Patel Wedding House',
      phone: '+91 87654 32109',
      email: 'weddings@patelhouse.com',
      address: '456 Ring Road, Ahmedabad 380001',
    },
    created_by: 'u1',
    created_at: new Date('2024-12-08'),
    updated_at: new Date('2024-12-09'),
    global_notes: 'Wedding cards - URGENT delivery required',
    is_completed: false,
    order_level_delivery_date: new Date('2024-12-12'),
    priority_computed: 'yellow',
    items: [
      {
        item_id: 'item-002-1',
        order_id: 'ORD-2024-002',
        product_name: 'Wedding Invitation Cards',
        quantity: 200,
        specifications: {
          paper: '300 GSM Textured',
          size: '6" x 8"',
          finishing: 'Letterpress + Gold Foiling',
          notes: 'Cream color base, traditional design',
        },
        need_design: true,
        current_stage: 'production',
        current_substage: 'foiling',
        assigned_to: 'u4',
        assigned_department: 'production',
        delivery_date: new Date('2024-12-12'),
        priority_computed: 'yellow',
        files: [
          {
            file_id: 'f1',
            url: '/proofs/wedding-proof-1.pdf',
            type: 'proof',
            uploaded_by: 'u2',
            uploaded_at: new Date('2024-12-08'),
            is_public: true,
          },
        ],
        is_ready_for_production: true,
        is_dispatched: false,
        created_at: new Date('2024-12-08'),
        updated_at: new Date('2024-12-09'),
      },
    ],
  },
  {
    order_id: 'ORD-2024-003',
    source: 'wordpress',
    customer: {
      name: 'Tech Solutions Ltd',
      phone: '+91 99887 76655',
      email: 'print@techsolutions.in',
      address: '789 IT Park, Bengaluru 560001',
    },
    created_by: 'u1',
    created_at: new Date('2024-12-09'),
    updated_at: new Date('2024-12-09'),
    is_completed: false,
    order_level_delivery_date: new Date('2024-12-11'),
    priority_computed: 'red',
    items: [
      {
        item_id: 'item-003-1',
        order_id: 'ORD-2024-003',
        product_name: 'Product Brochures',
        quantity: 5000,
        specifications: {
          paper: '170 GSM Art Paper',
          size: 'A4 Tri-fold',
          finishing: 'Gloss Lamination',
        },
        need_design: true,
        current_stage: 'sales',
        current_substage: null,
        assigned_department: 'sales',
        delivery_date: new Date('2024-12-11'),
        priority_computed: 'red',
        files: [],
        is_ready_for_production: false,
        is_dispatched: false,
        created_at: new Date('2024-12-09'),
        updated_at: new Date('2024-12-09'),
      },
      {
        item_id: 'item-003-2',
        order_id: 'ORD-2024-003',
        product_name: 'Company Folders',
        quantity: 500,
        specifications: {
          paper: '300 GSM Art Card',
          size: 'A4 with pocket',
          finishing: 'Spot UV on logo',
        },
        need_design: true,
        current_stage: 'sales',
        current_substage: null,
        assigned_department: 'sales',
        delivery_date: new Date('2024-12-11'),
        priority_computed: 'red',
        files: [],
        is_ready_for_production: false,
        is_dispatched: false,
        created_at: new Date('2024-12-09'),
        updated_at: new Date('2024-12-09'),
      },
    ],
    meta: {
      wp_order_id: 1235,
      imported: true,
    },
  },
  {
    order_id: 'ORD-2024-004',
    source: 'manual',
    customer: {
      name: 'Green Foods Pvt Ltd',
      phone: '+91 77665 54433',
      email: 'packaging@greenfoods.com',
      address: '321 Industrial Area, Pune 411001',
    },
    created_by: 'u1',
    created_at: new Date('2024-12-07'),
    updated_at: new Date('2024-12-09'),
    is_completed: false,
    order_level_delivery_date: new Date('2024-12-20'),
    priority_computed: 'blue',
    items: [
      {
        item_id: 'item-004-1',
        order_id: 'ORD-2024-004',
        product_name: 'Product Labels - Organic Range',
        quantity: 10000,
        specifications: {
          paper: 'Self-adhesive vinyl',
          size: '3" x 4"',
          finishing: 'Die-cut',
        },
        need_design: false,
        current_stage: 'production',
        current_substage: 'printing',
        assigned_to: 'u4',
        assigned_department: 'production',
        delivery_date: new Date('2024-12-20'),
        priority_computed: 'blue',
        files: [],
        is_ready_for_production: true,
        is_dispatched: false,
        created_at: new Date('2024-12-07'),
        updated_at: new Date('2024-12-09'),
      },
    ],
  },
];

// Mock Timeline entries
export const mockTimeline: TimelineEntry[] = [
  {
    timeline_id: 't1',
    order_id: 'ORD-2024-001',
    item_id: 'item-001-1',
    stage: 'sales',
    action: 'created',
    performed_by: 'u1',
    performed_by_name: 'Rajesh Kumar',
    notes: 'Order imported from WooCommerce',
    created_at: new Date('2024-12-05T10:00:00'),
    is_public: true,
  },
  {
    timeline_id: 't2',
    order_id: 'ORD-2024-001',
    item_id: 'item-001-1',
    stage: 'design',
    action: 'assigned',
    performed_by: 'u1',
    performed_by_name: 'Rajesh Kumar',
    notes: 'Assigned to Priya for design work',
    created_at: new Date('2024-12-05T11:30:00'),
    is_public: true,
  },
  {
    timeline_id: 't3',
    order_id: 'ORD-2024-002',
    item_id: 'item-002-1',
    stage: 'design',
    action: 'uploaded_proof',
    performed_by: 'u2',
    performed_by_name: 'Priya Sharma',
    notes: 'First proof ready for customer review',
    attachments: [{ url: '/proofs/wedding-proof-1.pdf', type: 'pdf' }],
    created_at: new Date('2024-12-08T14:00:00'),
    is_public: true,
  },
  {
    timeline_id: 't4',
    order_id: 'ORD-2024-002',
    item_id: 'item-002-1',
    stage: 'design',
    action: 'customer_approved',
    performed_by: 'u1',
    performed_by_name: 'Rajesh Kumar',
    notes: 'Customer approved design via phone',
    created_at: new Date('2024-12-08T16:00:00'),
    is_public: true,
  },
  {
    timeline_id: 't5',
    order_id: 'ORD-2024-002',
    item_id: 'item-002-1',
    stage: 'prepress',
    action: 'final_proof_uploaded',
    performed_by: 'u3',
    performed_by_name: 'Amit Patel',
    qty_confirmed: 200,
    paper_treatment: 'Cream textured 300 GSM',
    created_at: new Date('2024-12-08T18:00:00'),
    is_public: true,
  },
  {
    timeline_id: 't6',
    order_id: 'ORD-2024-002',
    item_id: 'item-002-1',
    stage: 'production',
    substage: 'foiling',
    action: 'substage_started',
    performed_by: 'u4',
    performed_by_name: 'Suresh Reddy',
    notes: 'Started gold foiling process',
    created_at: new Date('2024-12-09T09:00:00'),
    is_public: true,
  },
];

// Get orders by stage
export const getOrdersByStage = (stage: Stage): Order[] => {
  return mockOrders.filter(order => 
    order.items.some(item => item.current_stage === stage)
  );
};

// Get items by stage
export const getItemsByStage = (stage: Stage): (Order & { item: Order['items'][0] })[] => {
  const result: (Order & { item: Order['items'][0] })[] = [];
  mockOrders.forEach(order => {
    order.items.forEach(item => {
      if (item.current_stage === stage) {
        result.push({ ...order, item });
      }
    });
  });
  return result;
};

// Get timeline for order/item
export const getTimeline = (orderId: string, itemId?: string): TimelineEntry[] => {
  return mockTimeline
    .filter(entry => entry.order_id === orderId && (!itemId || entry.item_id === itemId))
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
};

// Get public timeline (for customer view)
export const getPublicTimeline = (orderId: string): TimelineEntry[] => {
  return mockTimeline
    .filter(entry => entry.order_id === orderId && entry.is_public)
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
};

// Dashboard stats
export const getDashboardStats = () => {
  const stats = {
    totalOrders: mockOrders.length,
    urgentItems: 0,
    byStage: {
      sales: 0,
      design: 0,
      prepress: 0,
      production: 0,
      dispatch: 0,
      completed: 0,
    },
    byPriority: {
      red: 0,
      yellow: 0,
      blue: 0,
    },
  };

  mockOrders.forEach(order => {
    order.items.forEach(item => {
      stats.byStage[item.current_stage]++;
      stats.byPriority[item.priority_computed]++;
      if (item.priority_computed === 'red') {
        stats.urgentItems++;
      }
    });
  });

  return stats;
};
