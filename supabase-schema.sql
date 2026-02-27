-- Equilibrium Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- Profiles table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text not null,
  avatar_url text,
  phone text,
  upi_id text,
  honesty_score integer default 100,
  settlement_streak integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Groups table
create table public.groups (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  emoji text default 'users',
  mode text default 'regular' check (mode in ('regular', 'trip')),
  personality text default 'chill' check (personality in ('chill', 'formal', 'roast')),
  invite_code text unique not null,
  is_active boolean default true,
  created_by uuid references public.profiles(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Group members junction table
create table public.group_members (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text default 'member' check (role in ('admin', 'member')),
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(group_id, user_id)
);

-- Expenses table
create table public.expenses (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  paid_by uuid references public.profiles(id) not null,
  title text not null,
  description text,
  amount decimal(12,2) not null check (amount > 0),
  category text default 'other',
  split_type text default 'equal' check (split_type in ('equal', 'percentage', 'exact', 'itemwise')),
  receipt_url text,
  date date default current_date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Expense splits (who owes what)
create table public.expense_splits (
  id uuid default uuid_generate_v4() primary key,
  expense_id uuid references public.expenses(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  amount decimal(12,2) not null,
  percentage decimal(5,2),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(expense_id, user_id)
);

-- Settlements (actual payments between users)
create table public.settlements (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  from_user uuid references public.profiles(id) not null,
  to_user uuid references public.profiles(id) not null,
  amount decimal(12,2) not null check (amount > 0),
  status text default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  payment_mode text,
  settled_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Expense reactions (emoji reactions)
create table public.expense_reactions (
  id uuid default uuid_generate_v4() primary key,
  expense_id uuid references public.expenses(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  emoji text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(expense_id, user_id, emoji)
);

-- Indexes for performance
create index idx_group_members_group on public.group_members(group_id);
create index idx_group_members_user on public.group_members(user_id);
create index idx_expenses_group on public.expenses(group_id);
create index idx_expenses_paid_by on public.expenses(paid_by);
create index idx_expense_splits_expense on public.expense_splits(expense_id);
create index idx_expense_splits_user on public.expense_splits(user_id);
create index idx_settlements_group on public.settlements(group_id);

-- Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.settlements enable row level security;
alter table public.expense_reactions enable row level security;

-- RLS Policies
-- Profiles: Users can read any profile, update only their own
create policy "Public profiles are viewable by everyone" on public.profiles
  for select using (true);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- Groups: Viewable by members
create policy "Groups viewable by members" on public.groups
  for select using (auth.uid() is not null);

create policy "Authenticated users can create groups" on public.groups
  for insert with check (auth.uid() = created_by);

create policy "Group admins can update groups" on public.groups
  for update using (
    exists (
      select 1 from public.group_members
      where group_members.group_id = groups.id
      and group_members.user_id = auth.uid()
      and group_members.role = 'admin'
    )
  );

-- Group members: Viewable by group members
create policy "Group members viewable by authenticated users" on public.group_members
  for select using (auth.uid() is not null);

create policy "Users can join groups" on public.group_members
  for insert with check (auth.uid() = user_id);

-- Expenses: Viewable by group members
create policy "Expenses viewable by group members" on public.expenses
  for select using (
    exists (
      select 1 from public.group_members
      where group_members.group_id = expenses.group_id
      and group_members.user_id = auth.uid()
    )
  );

create policy "Group members can add expenses" on public.expenses
  for insert with check (
    exists (
      select 1 from public.group_members
      where group_members.group_id = expenses.group_id
      and group_members.user_id = auth.uid()
    )
  );

create policy "Expense creator can update" on public.expenses
  for update using (auth.uid() = paid_by);

-- Expense splits
create policy "Splits viewable by group members" on public.expense_splits
  for select using (
    exists (
      select 1 from public.expenses e
      join public.group_members gm on gm.group_id = e.group_id
      where e.id = expense_splits.expense_id
      and gm.user_id = auth.uid()
    )
  );

create policy "Expense splits insertable by group members" on public.expense_splits
  for insert with check (
    exists (
      select 1 from public.expenses e
      join public.group_members gm on gm.group_id = e.group_id
      where e.id = expense_splits.expense_id
      and gm.user_id = auth.uid()
    )
  );

-- Settlements
create policy "Settlements viewable by group members" on public.settlements
  for select using (
    exists (
      select 1 from public.group_members
      where group_members.group_id = settlements.group_id
      and group_members.user_id = auth.uid()
    )
  );

create policy "Group members can create settlements" on public.settlements
  for insert with check (
    exists (
      select 1 from public.group_members
      where group_members.group_id = settlements.group_id
      and group_members.user_id = auth.uid()
    )
  );

create policy "Settlement parties can update" on public.settlements
  for update using (
    auth.uid() = from_user or auth.uid() = to_user
  );

-- Reactions
create policy "Reactions viewable by group members" on public.expense_reactions
  for select using (
    exists (
      select 1 from public.expenses e
      join public.group_members gm on gm.group_id = e.group_id
      where e.id = expense_reactions.expense_id
      and gm.user_id = auth.uid()
    )
  );

create policy "Users can add reactions" on public.expense_reactions
  for insert with check (auth.uid() = user_id);

create policy "Users can remove own reactions" on public.expense_reactions
  for delete using (auth.uid() = user_id);

-- Function: Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger: Auto-create profile
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Enable realtime for key tables
alter publication supabase_realtime add table public.expenses;
alter publication supabase_realtime add table public.settlements;
alter publication supabase_realtime add table public.expense_reactions;
