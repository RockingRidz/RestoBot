<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/13073baa-adf2-4de2-973a-a5fad3ab69b0

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. AI provider access is optional. It is disabled by default; deterministic forecasting remains available without it.

For the supplied synthetic Birchwood workspace, run `npm run demo:birchwood` from this directory and open http://127.0.0.1:3001. It keeps Supabase disconnected and fixture edits in memory. Provider-backed AI requests require an explicit enable flag, a positive daily cap, a server-only credential, and outbound network access. The default daily cap is zero, so credentials alone cannot create usage. The source fixture is incomplete and old; generated estimates do not establish current restaurant demand. To use port 3002 in PowerShell, set `$env:PORT='3002'` before launching.
3. Run the app:
   `npm run dev`

## Dashboard data and AI forecasts

Use **Generate AI forecast** to request a next-day prediction from the configured
configured AI service. `/api/ai/forecast` supplies the last 90 days of recorded daily sales,
validates one nonnegative prediction per active menu item, and calculates revenue
and purchasing from recorded prices, recipes and stock (10% safety buffer).
The saved response, including model, generation time and target date, is shared
by the dashboard, sales chart and editable order plan. Changing workspace records
invalidates the displayed forecast; generate again after changes. Reloading the
page also requires regeneration. No AI call runs just from opening a screen.

Missing credentials, missing recent history, malformed model output and storage
failures leave forecasts unavailable; no client-side baseline or sample forecast
is substituted. Actual sales, inventory and waste graphs remain record-derived.
Demo mode still explicitly displays sample restaurant records. Forecast accuracy
and waste savings stay unavailable until measured. The assistant no longer uses
canned supplier-price recommendations when the AI service is unavailable.

Configure `GEMINI_API_KEY` on the server and, if needed, `GEMINI_MODEL` for a model
available to your account. Never put this secret in a Vite client variable.
The older `/api/forecast` endpoint remains the deterministic baseline for existing
engine workflows and backtesting; the new Rinet screens use `/api/ai/forecast`.

## Order approval milestone — 25 September

The Daily Order Note requires an approved revision before clipboard or PDF export.
Quantity changes and exclusions require a reason. The server retrieves the saved
forecast, validates every suggested line, calculates costs from its stored prices,
and saves suggested/approved quantities, actor, time, reason and forecast ID in
the existing order history JSON. Approval records cannot be changed through the
status API. Further edits invalidate the UI approval and require a new revision.
Linked clipboard exports use the stored approved text and preserve its reference.
Expand an Order History note to inspect the saved details. Local demo approvals
have no verified user and are explicitly identified as such.

This records approved revisions, not every unsaved keystroke. Legacy export
endpoints remain compatible and do not enforce this new screen's approval gate.
Live database durability for this new approval flow still needs verification;
automated API tests use isolated memory storage. Public launch still requires
multi-restaurant isolation/permission testing, live AI and real-history evaluation,
production deployment/monitoring, backup restore verification and a restaurant pilot.
