-- =====================================================================
-- Kwata Shop — Creation des tables (V1) — Supabase / PostgreSQL
-- A executer AVANT le script kwata_shop_rls_policies.sql
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- USERS (etend auth.users)
-- ---------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  role text not null default 'acheteur' check (role in ('acheteur', 'vendeur', 'admin', 'moderateur')),
  locale text not null default 'fr',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- SHOPS
-- ---------------------------------------------------------------------
create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('detaillant', 'grossiste', 'fabricant', 'artisan')),
  description text,
  verification_status text not null default 'en_attente' check (verification_status in ('en_attente', 'partiel', 'valide', 'suspendu')),
  rating_avg numeric(2,1) not null default 0,
  created_at timestamptz not null default now()
);

create index shops_owner_id_idx on public.shops(owner_id);

-- ---------------------------------------------------------------------
-- CATEGORIES (arborescence via parent_id)
-- ---------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique
);

-- ---------------------------------------------------------------------
-- PRODUCTS
-- ---------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  description text,
  price_retail numeric(12,2) not null,
  price_wholesale numeric(12,2),
  min_wholesale_qty int,
  currency text not null default 'XAF',
  stock int not null default 0,
  status text not null default 'actif' check (status in ('actif', 'inactif', 'rupture')),
  created_at timestamptz not null default now()
);

create index products_shop_id_idx on public.products(shop_id);
create index products_category_id_idx on public.products(category_id);

-- ---------------------------------------------------------------------
-- PRODUCT_VARIANTS
-- ---------------------------------------------------------------------
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  price_delta numeric(12,2) not null default 0,
  stock int not null default 0
);

create index product_variants_product_id_idx on public.product_variants(product_id);

-- ---------------------------------------------------------------------
-- PRODUCT_IMAGES
-- ---------------------------------------------------------------------
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  position int not null default 0
);

create index product_images_product_id_idx on public.product_images(product_id);

-- ---------------------------------------------------------------------
-- ADDRESSES
-- ---------------------------------------------------------------------
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  label text,
  address_line text not null,
  city text not null,
  region text,
  country text not null default 'CM'
);

create index addresses_user_id_idx on public.addresses(user_id);

-- ---------------------------------------------------------------------
-- ORDERS
-- ---------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.users(id) on delete restrict,
  address_id uuid references public.addresses(id),
  status text not null default 'en_attente' check (status in ('en_attente', 'confirmee', 'expediee', 'livree', 'annulee')),
  total_amount numeric(12,2) not null default 0,
  currency text not null default 'XAF',
  created_at timestamptz not null default now()
);

create index orders_buyer_id_idx on public.orders(buyer_id);

-- ---------------------------------------------------------------------
-- ORDER_ITEMS (une ligne par produit, denormalise shop_id pour le RLS vendeur)
-- ---------------------------------------------------------------------
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  shop_id uuid not null references public.shops(id) on delete restrict,
  quantity int not null check (quantity > 0),
  unit_price numeric(12,2) not null,
  status text not null default 'en_attente' check (status in ('en_attente', 'a_expedier', 'expediee', 'livree'))
);

create index order_items_order_id_idx on public.order_items(order_id);
create index order_items_shop_id_idx on public.order_items(shop_id);

-- ---------------------------------------------------------------------
-- PAYMENTS
-- ---------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null check (provider in ('orange_money', 'mtn_momo', 'carte')),
  status text not null default 'en_attente' check (status in ('en_attente', 'confirme', 'echoue', 'rembourse')),
  amount numeric(12,2) not null,
  transaction_ref text,
  created_at timestamptz not null default now()
);

create index payments_order_id_idx on public.payments(order_id);

-- ---------------------------------------------------------------------
-- QUOTES (devis / negociation B2B — prevu V1 en lecture seule pour V2)
-- ---------------------------------------------------------------------
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.users(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity int not null,
  proposed_price numeric(12,2),
  status text not null default 'envoye' check (status in ('envoye', 'contre_offre', 'accepte', 'refuse')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- SHIPMENTS
-- ---------------------------------------------------------------------
create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  carrier text,
  tracking_number text,
  status text not null default 'en_preparation' check (status in ('en_preparation', 'expediee', 'en_livraison', 'livree')),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- DISPUTES
-- ---------------------------------------------------------------------
create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  opened_by uuid not null references public.users(id),
  reason text not null,
  status text not null default 'ouvert' check (status in ('ouvert', 'en_cours', 'resolu', 'rejete')),
  resolution text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- REVIEWS
-- ---------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  shop_id uuid references public.shops(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- AUDIT_LOGS
-- ---------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.users(id),
  action text not null,
  target_type text not null,
  target_id uuid,
  created_at timestamptz not null default now()
);
