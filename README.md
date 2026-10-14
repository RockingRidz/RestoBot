# RestoBot

RestoBot is an AI-powered food-waste reduction and restaurant operations platform created by **Ridith S. Shetty**. It combines demand forecasting, inventory monitoring, recipe costing, waste analytics, margin protection, and purchasing recommendations in one authenticated workspace.

## Purpose

Restaurants often over-purchase ingredients because their sales, recipes, inventory, supplier information, and waste records are stored separately. RestoBot connects those records so a restaurant can estimate demand, identify low stock, understand ingredient usage, review waste, and prepare safer purchase plans.

The application supports Ridith's India Book of Records submission for **Youngest Creator of AI for Restaurant Food Waste Management**.

## Main features

- Authenticated restaurant workspaces backed by Supabase
- Restaurant-level row security and isolated account data
- Daily demand forecasting from recorded sales history
- Interactive sales, inventory, waste, and performance graphs
- Ingredient inventory with thresholds, costs, suppliers, and pack sizes
- Complete recipes linked to menu dishes and ingredients
- Recipe costing and target-margin monitoring
- Waste logging with quantity, reason, and estimated loss
- Smart purchasing recommendations based on forecast demand and current stock
- Reviewable daily order notes and order-history records
- Optional server-side AI assistance with strict usage controls
- Deterministic forecasting when external AI is disabled

## Technology

- React 19 and TypeScript
- Vite
- Express
- Supabase Auth and PostgreSQL
- Recharts
- Node.js

## Local setup

Requirements: Node.js 20 or newer and a Supabase project with the included migrations applied.

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Never commit `.env.local`. Public browser configuration uses the Supabase URL and anonymous key; the service-role key and optional AI key must remain server-only.

## Environment configuration

Copy `.env.example` and provide the required values:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `RESTOBOT_RESTAURANT_ID`

Public signup is disabled by default. AI requests and automated draft scheduling are also disabled by default and require explicit server-side configuration.

## Database setup

Apply the SQL files in `supabase/migrations` in numerical order. They create the restaurant, profile, ingredient, recipe, sales, forecast, waste, supplier, and order tables together with tenant-aware access policies and atomic workflows.

## Testing and production build

```bash
npm test
npm run build
```

The production server exposes `/healthz` for deployment health checks.

## Render deployment

This repository includes `render.yaml`.

1. Create a Render Blueprint from this GitHub repository.
2. Enter the Supabase values in Render's private environment-variable interface.
3. Never paste the service-role key into source code or a public variable.
4. Deploy the service.
5. Add the final Render address to Supabase's allowed redirect URLs.
6. Verify authentication, graphs, recipes, inventory, forecasts, waste records, and order history using the dedicated reviewer account.

The blueprint keeps public signup, automatic supplier actions, scheduled drafts, and paid AI usage disabled. These features should only be enabled after explicit operational review.

## Demonstration data

The repository contains clearly labelled synthetic data for reproducible demonstrations and graph testing. Synthetic records are not presented as real restaurant measurements, customer results, financial savings, or proof of forecast accuracy.

## Safety and data handling

- Secrets and environment files are excluded by `.gitignore`.
- Supplier delivery is not automatic.
- Purchase recommendations require human review.
- AI-generated output is advisory and must be verified by the restaurant.
- Real customer, payment, and personally identifiable restaurant data should not be committed.

## Creator

Designed and developed by **Ridith S. Shetty**.

RestoBot — smarter restaurant planning, lower waste, and better purchasing decisions.
