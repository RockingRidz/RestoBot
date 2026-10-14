# Restaurant inputs and forecast evaluation

Send anonymized POS exports with stable order/line IDs, timestamp including timezone,
item name, quantity, price, and explicit refund/void status. Include at least 8–12
weeks if available, including quiet weeks. Remove customer names, contact details
and payment data. Also provide restaurant timezone, opening/closure calendar,
menu introduction dates, recipe amounts/units, stock counts, supplier pack sizes,
prices and ordering/delivery cutoffs. Identify which files are actual records,
business instructions or example answers.

Refunds/returns/voids currently stop the operational CSV import for owner review.
Do not delete those rows to bypass the check. A refund does not establish whether
food was prepared, stock was consumed, or stock should be restored. Agree those
rules with the owner before importing reconciled data.

## Offline backtest

Prepare an owner-confirmed daily item panel with columns `date,item_name,quantity`.
Use one row per item/calendar date. Quantity is fulfilled item units, not dollars,
orders or covers. Record zero explicitly only when confirmed. Missing days mean
unknown, not zero. Convert POS timestamps to Detroit calendar dates first;
the evaluation accepts these date labels and uses date arithmetic on the labels.
Operational scheduling and forecast targets use the same Detroit calendar.

From `__zip_inspect`:

```sh
npm run backtest -- daily.csv 2026-09-01 report.json 1
```

The output file must not already exist. Repeat for relevant forecast horizons.
The report contains chronological predictions, MAE, WAPE (ratio, not percent),
signed mean bias, a last-matching-weekday baseline, per-item metrics and skipped
windows. Each forecast sees only observations available at its origin. Later
evaluations can use earlier test days once those days have elapsed, as in daily
operation. Overlapping multi-day windows are not independent samples.

Reserve a final untouched evaluation period after choosing settings. Agree acceptable
forecast error, bias, stockouts and waste with the pilot owner before tuning.
No report from synthetic fixtures establishes real restaurant accuracy.

## What “training the bot” means today

RestoBot uses historical sales to estimate demand, then deterministic code converts
demand through recipes and inventory into purchasing quantities. An existing AI
model supplies language assistance and explanations using business context and
examples. Updating prompts is configuration, not training the model's weights.
The current development prompt console is in memory and disabled in production;
a durable, reviewed knowledge workflow is still needed for public deployment.

We will validate new files, reconcile units and unusual transactions, evaluate on
later withheld dates, compare to the weekday baseline, and tune only where evidence
improves results. There is no claim of a proprietary model trained from scratch or
85% prediction accuracy.
