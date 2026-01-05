-- Inventory Module Phase 1: Paper Inventory

-- 1. Create paper_inventory table
CREATE TABLE paper_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  brand TEXT,
  gsm INTEGER NOT NULL,
  width NUMERIC(10, 2) NOT NULL, -- in inches
  height NUMERIC(10, 2) NOT NULL, -- in inches
  unit TEXT DEFAULT 'sheets',
  total_sheets INTEGER DEFAULT 0 CHECK (total_sheets >= 0),
  reserved_sheets INTEGER DEFAULT 0 CHECK (reserved_sheets >= 0),
  available_sheets INTEGER GENERATED ALWAYS AS (total_sheets - reserved_sheets) STORED CHECK (available_sheets >= 0),
  reorder_threshold INTEGER DEFAULT 100,
  location TEXT,
  status TEXT CHECK (status IN ('active', 'discontinued')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create inventory_transactions table (Audit Log)
CREATE TABLE inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id UUID NOT NULL REFERENCES paper_inventory(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('in', 'out', 'reserve', 'release', 'consume', 'adjust')),
  quantity INTEGER NOT NULL, -- Can be negative for corrections, but usually logic handles sign
  job_id UUID REFERENCES orders(id) ON DELETE SET NULL, -- specific order related
  performed_by UUID REFERENCES auth.users(id), -- User who did it
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create job_materials table (Allocations)
CREATE TABLE job_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  paper_id UUID NOT NULL REFERENCES paper_inventory(id),
  sheets_required INTEGER NOT NULL DEFAULT 0,
  sheets_allocated INTEGER NOT NULL DEFAULT 0,
  status TEXT CHECK (status IN ('reserved', 'consumed', 'released')) DEFAULT 'reserved',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_paper_status ON paper_inventory(status);
CREATE INDEX idx_transactions_paper ON inventory_transactions(paper_id);
CREATE INDEX idx_transactions_job ON inventory_transactions(job_id);
CREATE INDEX idx_job_materials_job ON job_materials(job_id);

-- 4. Trigger Function to Auto-Calculate Inventory
-- This function listens to 'inventory_transactions' and updates 'paper_inventory'
-- We DO NOT edit paper_inventory directly.
CREATE OR REPLACE FUNCTION process_inventory_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle INSERT only (Immutable log)
  IF (TG_OP = 'INSERT') THEN
    
    -- TYPE: 'in' (Purchase / Stock In) -> Increase Total
    IF NEW.type = 'in' THEN
      UPDATE paper_inventory 
      SET total_sheets = total_sheets + NEW.quantity,
          updated_at = NOW()
      WHERE id = NEW.paper_id;
    
    -- TYPE: 'out' (Damage / Correction / Stock Out) -> Decrease Total
    ELSIF NEW.type = 'out' THEN
      UPDATE paper_inventory 
      SET total_sheets = total_sheets - NEW.quantity,
          updated_at = NOW()
      WHERE id = NEW.paper_id;

    -- TYPE: 'reserve' (Job Allocation) -> Increase Reserved
    ELSIF NEW.type = 'reserve' THEN
      UPDATE paper_inventory 
      SET reserved_sheets = reserved_sheets + NEW.quantity,
          updated_at = NOW()
      WHERE id = NEW.paper_id;

    -- TYPE: 'release' (Job Cancellation) -> Decrease Reserved
    ELSIF NEW.type = 'release' THEN
      UPDATE paper_inventory 
      SET reserved_sheets = reserved_sheets - NEW.quantity,
          updated_at = NOW()
      WHERE id = NEW.paper_id;

    -- TYPE: 'consume' (Production Done) -> Decrease Reserved AND Decrease Total
    ELSIF NEW.type = 'consume' THEN
      UPDATE paper_inventory 
      SET reserved_sheets = reserved_sheets - NEW.quantity,
          total_sheets = total_sheets - NEW.quantity,
          updated_at = NOW()
      WHERE id = NEW.paper_id;
      
   -- TYPE: 'adjust' (Manual Override) -> Sets Total directly (handled via diff in app, or logic here?)
   -- For safety, 'adjust' should function like in/out but explicitly labelled.
   -- Let's assume input quantity is the DELTA.
    ELSIF NEW.type = 'adjust' THEN
       UPDATE paper_inventory 
       SET total_sheets = total_sheets + NEW.quantity,
           updated_at = NOW()
       WHERE id = NEW.paper_id;

    END IF;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger Definition
CREATE TRIGGER tr_inventory_update
AFTER INSERT ON inventory_transactions
FOR EACH ROW
EXECUTE FUNCTION process_inventory_transaction();


-- 5. RLS Policies

-- Enable RLS
ALTER TABLE paper_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_materials ENABLE ROW LEVEL SECURITY;

-- Policy Views for Role Check (Assuming 'user_roles' view exists from previous migrations)
-- Admin: Full Access
CREATE POLICY "Admins have full access to paper_inventory" ON paper_inventory
FOR ALL USING (
  exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  OR
  exists (select 1 from user_roles where user_id = auth.uid() and role = 'super_admin')
);

CREATE POLICY "Admins have full access to transactions" ON inventory_transactions
FOR ALL USING (
  exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  OR
  exists (select 1 from user_roles where user_id = auth.uid() and role = 'super_admin')
);

CREATE POLICY "Admins have full access to job_materials" ON job_materials
FOR ALL USING (
  exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  OR
  exists (select 1 from user_roles where user_id = auth.uid() and role = 'super_admin')
);

-- Production / Prepress: Read Paper, Create Transactions (Logs), Manage Job Materials
CREATE POLICY "Staff read paper_inventory" ON paper_inventory
FOR SELECT USING (
  auth.role() = 'authenticated'
);

-- Production can Insert 'consume' or 'reserve' transactions
CREATE POLICY "Production create transactions" ON inventory_transactions
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' -- We trust the frontend app logic + trigger constraints for now
  -- Ideally specific checks on 'type' vs 'role' could be added here
);

CREATE POLICY "Staff manage job_materials" ON job_materials
FOR ALL USING (
  auth.role() = 'authenticated'
);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE paper_inventory;
ALTER PUBLICATION supabase_realtime ADD TABLE job_materials;
