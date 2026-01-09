drop table if exists app_settings;

create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table app_settings enable row level security;

-- Everyone needs to read the workflow config
create policy "Enable read access for all users"
on app_settings for select
using (true);

-- Only admins can modify settings
create policy "Enable insert for admins only"
on app_settings for insert
with check (
  exists (
    select 1 from user_roles
    where user_id = auth.uid()
    and role = 'admin'
  )
);

create policy "Enable update for admins only"
on app_settings for update
using (
  exists (
    select 1 from user_roles
    where user_id = auth.uid()
    and role = 'admin'
  )
)
with check (
  exists (
    select 1 from user_roles
    where user_id = auth.uid()
    and role = 'admin'
  )
);

-- Insert default workflow config if not exists (optional, but good for bootstrapping)
insert into app_settings (key, value)
values (
  'workflow_config',
  '{
    "departments": [
      {
        "id": "sales",
        "label": "Sales (Approval)",
        "description": "Submit for client approval",
        "icon": "ShoppingCart",
        "color": "text-blue-500",
        "bg": "bg-blue-500/10",
        "statuses": [
          { "value": "design_pending_approval", "label": "Pending Approval" }
        ]
      },
      {
        "id": "production",
        "label": "Production",
        "description": "Design approved, ready for print",
        "icon": "Factory",
        "color": "text-emerald-500",
        "bg": "bg-emerald-500/10",
        "statuses": [
          { "value": "design_completed", "label": "Design Completed" },
          { "value": "ready_for_production", "label": "Ready for Production" }
        ]
      },
      {
        "id": "prepress",
        "label": "Prepress",
        "description": "Send for print file preparation",
        "icon": "FileCheck",
        "color": "text-amber-500",
        "bg": "bg-amber-500/10",
        "statuses": [
          { "value": "design_completed", "label": "Design Completed" },
          { "value": "ready_for_prepress", "label": "Ready for Prepress" }
        ]
      },
      {
        "id": "outsource",
        "label": "Outsource",
        "description": "External vendor work",
        "icon": "Building2",
        "color": "text-purple-500",
        "bg": "bg-purple-500/10",
        "statuses": [
          { "value": "design_completed", "label": "Design Completed" },
          { "value": "ready_for_outsource", "label": "Ready for Outsource" }
        ]
      }
    ]
  }'::jsonb
)
on conflict (key) do nothing;
