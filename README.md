<!--
  README.md -- Google Tag Manager + manual Meta pixel on a checkout with no data layer
  Author:  Jibril Sulaiman
  Created: 2026-10-15 (from a production build first shipped May 2025)
  What:    Install Google Tag Manager, scrape the order confirmation page into GTM
           variables, send a GA4 purchase, and send Meta's Purchase event by hand
           (Custom HTML), with the ad click id kept so orders placed days later
           still tie back to the ad.
  Why:     The checkout had no data layer, Meta's Purchase arrived without a value
           on about half of orders, and the developers' queue was months long. This
           does it all inside Tag Manager.
-->

# Google Tag Manager and a manual Meta pixel on a checkout with no data layer

Track purchases from a checkout you can't change much: a hosted ecommerce or
membership platform (this build ran on an ASP.NET **Aptify e-Business** order
confirmation page) that has **no data layer**. You install Google Tag Manager once,
then read the order number, total, customer number and first line item straight off
the confirmation page, and send:

- a **GA4 `purchase`** event with the real revenue and order number, and
- a **Meta pixel `Purchase`** event, added by hand as Custom HTML because Tag Manager
  has no Meta pixel tag type, with the value Meta was missing.

A small cookie tag also keeps Meta's click id (`fbclid` / `_fbc`) for 90 days, so a
buyer who clicks an ad on Monday and orders on Friday is still matched to the ad.

## Why it exists

- **No data layer.** Every GTM ecommerce guide starts with "push your order to the
  data layer". This checkout pushed nothing, and adding it meant a developer ticket
  on a platform the team didn't control. Everything here reads the page instead.
- **Meta's Purchase arrived without a value.** Events Manager flagged the Purchase
  event: *"Value field is missing. Number must be more than 0"* on about half of
  purchases. Without a value Meta can't report revenue (ROAS) or optimise for it.
  Meta's own fix ("ask your developer to pass the value dynamically") was exactly the
  code change that wasn't available.
- **Tag Manager has no Meta pixel tag.** The tag picker offers Google tags, LinkedIn
  Insight, Custom HTML and Custom Image, but no *Facebook Pixel* type. The pixel has
  to be pasted in as Custom HTML.
- **The click id is gone on return visits.** `fbclid` exists only in the landing URL.
  Plenty of buyers come back later by typing the address. Unless the click id was
  saved on the first visit, nothing on the order links it to the ad.
- **No server-side option.** The team couldn't store UTMs or click ids in the CRM or
  run Meta's Conversions API, so this is browser-only, by design.

## How it works

```text
 Meta ad click   https://shop.example.com/landing?fbclid=AbC123...
        │
        ▼
 Every page ── GTM container (install/gtm-container-snippet.html)
        ├─ Meta Pixel - Base ............ PageView               (All Pages)
        └─ Set Facebook Attribution Cookies
              _fbc   = fb.1.<timestamp>.<fbclid>   90 days
              fbclid = <fbclid>                    90 days
        │   ...buyer leaves, comes back days later, checks out
        ▼
 Order confirmation page  /OrderConfirmation.aspx?ID=1234567
        GTM reads the page (DOM Element variables):
          Order Number · Grand Total · Customer Number · Product Name · Unit Price
        Custom JavaScript variables clean "$1,379.00" → 1379
        │
        ├─ GA4 - Event - Scrape Purchase   purchase, value, transaction_id, items,
        │                                  refer_source, cookie_fbc, cookie_fbp, fbclid
        └─ FB Purchase - Order Confirmation
                                           fbq('track','Purchase',{value, currency,
                                           order_id}, {eventID: order number})
```

## What's in this repo

| Path | What it is | Where it goes |
|---|---|---|
| [`install/`](install/) | Google's container snippet, with placeholders | Your site's master page template (Step 1) |
| [`variables/`](variables/) | The three Custom JavaScript variables | Tag Manager → Variables (Steps 4 and 5) |
| [`tags/`](tags/) | The three Custom HTML tags: click id cookies, pixel base, Purchase | Tag Manager → Tags (Steps 6, 9 and 10) |

## Table of contents

1. [Requirements](#1-requirements)
2. [Setup, step by step](#2-setup-step-by-step)
   - [Step 1: Install the container](#step-1-install-the-container)
   - [Step 2: Make sure a Google tag is in the container](#step-2-make-sure-a-google-tag-is-in-the-container)
   - [Step 3: DOM Element variables for the order fields](#step-3-dom-element-variables-for-the-order-fields)
   - [Step 4: Clean the money values](#step-4-clean-the-money-values)
   - [Step 5: The source variable](#step-5-the-source-variable)
   - [Step 6: Keep Meta's click id in cookies](#step-6-keep-metas-click-id-in-cookies)
   - [Step 7: The order confirmation trigger](#step-7-the-order-confirmation-trigger)
   - [Step 8: GA4 purchase from the page](#step-8-ga4-purchase-from-the-page)
   - [Step 9: Meta pixel base code](#step-9-meta-pixel-base-code)
   - [Step 10: Meta Purchase event](#step-10-meta-purchase-event)
   - [Step 11: Register the GA4 custom dimensions](#step-11-register-the-ga4-custom-dimensions)
   - [Step 12: Test, publish, and prove the days-later match](#step-12-test-publish-and-prove-the-days-later-match)
3. [Troubleshooting](#troubleshooting)
4. [Limits](#limits)
5. [Security and privacy](#security-and-privacy)

## 1. Requirements

- **Google Tag Manager**: a web container and *Publish* rights on it.
- **A way to add the container snippet** to the site template once (Step 1). If the
  container is already on the checkout pages, skip that step.
- **GA4**: a property with a web data stream, and Editor access for custom
  dimensions.
- **Meta Events Manager**: your dataset (pixel) id, and access to *Test events*.
- **Chrome** (or any browser with dev tools), for checking cookies and selectors.
- **A real test order** you can place and look at the confirmation page of. Free
  orders work for checking the tags; a paid one is needed to check revenue.

## 2. Setup, step by step

### Step 1: Install the container

About 10 minutes for you, plus however long the site change takes.

**1a. Get the snippet.** In [Tag Manager](https://tagmanager.google.com/) open your
container, click **Admin → Install Google Tag Manager**. It shows two code boxes. They
match [`install/gtm-container-snippet.html`](install/gtm-container-snippet.html),
which has `GTM-XXXXXXX` where your container id goes.

**1b. Add it to the site template.** Hand all of
[`install/gtm-container-snippet.html`](install/gtm-container-snippet.html) to whoever
edits the site's master page / layout template:

| Part | Goes |
|---|---|
| Part 1 (`<script>`) | As high in `<head>` as possible |
| Part 2 (`<noscript>`) | Immediately after the opening `<body>` tag |

It has to be the template every page uses, so it reaches the cart, checkout and
order confirmation pages, not just the marketing site.

> ⚠️ **Hosted checkouts often live on a separate subdomain** (`shop.example.com` next
> to `www.example.com`) with their own template. Check the confirmation page itself,
> not the home page.

✅ **Check:** open the order confirmation page, view source, and find
`googletagmanager.com/gtm.js?id=GTM-` with your id. Or open **Preview** in Tag Manager,
enter the site URL, and see **Connected** in Tag Assistant.

### Step 2: Make sure a Google tag is in the container

About 5 minutes.

GA4 event tags need a **Google tag** for your measurement id in the same container.

**2a.** In Tag Manager click **Tags**. Look for a tag of type **Google Tag** with
your GA4 measurement id (`G-…`). If there is one, skip to Step 3.

**2b.** If not: **Tags → New → Tag Configuration → Google Tag**. **Tag ID:** your
measurement id (GA4 → **Admin → Data streams →** your web stream → **Measurement
ID**). **Triggering:** **Initialization - All Pages**. Name it `Google Tag - GA4` and
**Save**.

> ⚠️ **There is no "GA4 Configuration" tag type any more.** Older guides (and
> chatbots trained on them) say to create a *Google Analytics: GA4 Configuration*
> tag. The tag picker now offers only **Google Tag**, which replaced it. Don't build a
> *GA4 Event* tag and call it "Configuration": it sends nothing on its own.

✅ **Check:** open any GA4 event tag later and you'll see *"Google tag found in this
container. This tag will use the configuration of Google tag …"* next to the
Measurement ID.

### Step 3: DOM Element variables for the order fields

About 15 minutes.

No data layer, so each field is read from its element on the confirmation page.

**3a. Find the selectors.** Place a test order. On the confirmation page, right-click
the order number → **Inspect**. Note the element's `id`. Repeat for each field below.
On ASP.NET pages the ids are long and stable, for example (these are the Aptify
e-Business ids from this build; yours may differ):

| GTM variable name | Element ID on the page |
|---|---|
| `Order Number` | `Content_OrderConfirmation__c_lblOrderNumber` |
| `Grand Total` | `Content_OrderConfirmation__c_lblGrandTotal` |
| `Customer Number` | `Content_OrderConfirmation__c_lblBillToID` |
| `Product Name` | `ctl00_Content_OrderConfirmation__c_grdMain_ctl00_ctl04_link` |
| `Product Description` | `ctl00_Content_OrderConfirmation__c_grdMain_ctl00_ctl04_lblQuantity` |
| `Unit Price` | `ctl00_Content_OrderConfirmation__c_grdMain_ctl00_ctl04_lblPrice` |

**3b. Make a folder.** **Folders → New Folder**, name it `Order Summary Scrape`. Put
every variable and tag from this guide in it, so the whole setup can be found and
exported as one piece.

**3c. Create each variable.** **Variables → User-Defined Variables → New → Variable
Configuration → DOM Element**:

1. **Selection Method:** **ID**
2. **Element ID:** the id from the table (no `#`)
3. **Attribute Name:** leave blank, so the variable returns the element's text
4. Name it exactly as in the table's first column, put it in the
   `Order Summary Scrape` folder, and **Save**.

> ⚠️ **The `ctl00_…_ctl04_…` ids are row 1 of the line-item grid.** They read the
> first product only. Orders with several items still send the right total and order
> number; only the item detail is first-line-only.

> ⚠️ **Don't send the "Bill To" name anywhere.** This build also scraped the
> billing name (`Content_OrderConfirmation__c_blkBillTo_lblName`) and sent it to GA4
> as `customer_name`. Google's GA4 terms forbid personal names; leave that variable
> out of every tag.

✅ **Check:** **Preview**, place a test order, click the confirmation page's
**DOM Ready** event in Tag Assistant → **Variables** tab. Each variable shows the
value on screen, e.g. `Order Number` = `1234567`, `Grand Total` = `$249.00`.

### Step 4: Clean the money values

About 5 minutes.

The scraped total is text with a `$`. GA4 and Meta need a number.

**4a.** **Variables → New → Custom JavaScript**. Delete the sample code and paste in
**all** of [`variables/clean-grand-total.js`](variables/clean-grand-total.js). Name it
`Clean Grand Total`, folder `Order Summary Scrape`, **Save**.

**4b.** Same again with **all** of
[`variables/clean-unit-price.js`](variables/clean-unit-price.js), named
`Clean Unit Price`.

| Variable | Reads | Returns |
|---|---|---|
| `Clean Grand Total` | `{{Grand Total}}` | `1379` from `$1,379.00`; `0` if empty |
| `Clean Unit Price` | `{{Unit Price}}` | the same for the first line's price |

> ⚠️ **The variable names inside the code must match Step 3 exactly**, braces and
> spaces included (`{{Grand Total}}`). A typo is a publish error, not a silent zero.

✅ **Check:** in Preview, `Clean Grand Total` shows `249` (a number, no quotes) where
`Grand Total` shows `$249.00`.

### Step 5: The source variable

About 5 minutes.

**5a.** **Variables → New → Custom JavaScript**, paste in **all** of
[`variables/refer-source.js`](variables/refer-source.js), name it `Refer Source`,
**Save**. It returns the page URL's `utm_source`, or `direct`.

> ⚠️ **GTM variables are ES5.** The first version used `const`, and **Submit** stopped
> with *Validate Container: "JavaScript compiler error … This language feature is
> only supported for ECMASCRIPT_2015 mode or better: const declaration."* Use `var`.

> ⚠️ **It only sees the confirmation page's own URL.** In production almost every
> order read `direct`, because buyers reach the confirmation page through the cart,
> not from the ad. Treat it as a test aid; the click-id cookies (Step 6) are what tie
> orders to Meta ads. See [Limits](#limits).

✅ **Check:** open the confirmation page with `&utm_source=test` added to its URL in
Preview; `Refer Source` = `test`.

### Step 6: Keep Meta's click id in cookies

About 10 minutes.

**6a. The cookie tag.** **Tags → New → Tag Configuration → Custom HTML**. Delete
anything in the box and paste in **all** of
[`tags/set-facebook-attribution-cookies.html`](tags/set-facebook-attribution-cookies.html).
**Triggering → All Pages**. Name it `Set Facebook Attribution Cookies`, folder
`Order Summary Scrape`, **Save**.

| Cookie it writes | Value | Life | Used by |
|---|---|---|---|
| `_fbc` | `fb.1.<ms timestamp>.<fbclid>` | 90 days | the Meta pixel, automatically |
| `fbclid` | the raw click id | 90 days | your GA4 / Looker Studio reports |

It writes nothing when there's no `fbclid` in the URL, so it never overwrites a saved
click with an empty one.

**6b. Cookie variables.** **Variables → New → 1st Party Cookie**, one per row. Leave
**URI-decode cookie** unticked (wording may differ); these values have nothing
encoded.

| Variable name | Cookie Name |
|---|---|
| `cookie_fbc` | `_fbc` |
| `cookie_fbp` | `_fbp` (Meta's browser id, written by the pixel) |
| `cookie_fbclid` | `fbclid` |

> ⚠️ **`fbclid` is never a cookie on its own.** Meta keeps the click only as `_fbc`.
> The first report had an empty `fbclid` column even though `cookie_fbc` was filled,
> which is why the tag also saves the raw value.

> ⚠️ **`_fbp` alone doesn't prove an ad click.** Every visitor whose browser ran the
> pixel has one, ad or not. Only `_fbc` (or `fbclid`) shows the visit came from a
> Meta ad click.

✅ **Check:** open any page with `?fbclid=test123` on the URL, then dev tools →
**Application → Cookies →** your domain: `_fbc` = `fb.1.<13 digits>.test123` and
`fbclid` = `test123`.

### Step 7: The order confirmation trigger

About 5 minutes.

**7a.** **Triggers → New → Trigger Configuration → DOM Ready**.

**7b.** **This trigger fires on:** **Some DOM Ready Events**. Condition:
**Page URL** · **contains** · `OrderConfirmation.aspx` (your confirmation page's path).

**7c.** Name it `DOM Ready - Order Confirmation` and **Save**.

> ⚠️ **One condition only.** The production version of this trigger also had
> `gtm.js equals gtm.dom`, an attempt to wait for the page. That condition is never
> true, and the purchase tag showed **Not Fired** in Tag Assistant with a red ✗ on
> that row. Use the **DOM Ready** trigger type to wait for the page instead.

> ⚠️ **Why DOM Ready and not Page View.** A Page View trigger can fire before the
> order table has loaded, and the DOM variables come back empty.

✅ **Check:** in Preview on the confirmation page, the trigger shows a green ✓ under
the tag's **Firing Triggers** on the **DOM Ready** event.

### Step 8: GA4 purchase from the page

About 20 minutes.

**8a. Import the ecommerce object template.** It builds the `items` list for GA4
from your variables. It isn't always found by the gallery search, so import it:

1. Download `template.tpl` from
   [github.com/gtm-templates-simo-ahava/enhanced-ecommerce-object-builder](https://github.com/gtm-templates-simo-ahava/enhanced-ecommerce-object-builder).
2. **Templates → Variable Templates → New**, then the **⋮** menu → **Import**, pick
   the file, **Save**. (Or **Search Gallery** for *Enhanced Ecommerce Object Builder*
   and **Add to workspace** if it shows up.)

**8b. Build the object.** **Variables → New → Enhanced Ecommerce Object Builder**:

| Field | Value |
|---|---|
| **Type** | **Purchase** |
| **Set Currency Code** | ticked, **Currency Code** `USD` |
| **Purchase And Refund → Transaction ID** | `{{Order Number}}` |
| **Affiliation** (wording may differ) | your store name |
| **Revenue** (wording may differ) | `{{Clean Grand Total}}` |
| **Products** (wording may differ): Name / Category / Price / Quantity | `{{Product Name}}` / `{{Product Description}}` / `{{Clean Unit Price}}` / `1` |

Name it `EE - Purchase Object`, **Save**.

**8c. The GA4 event tag.** **Tags → New → Tag Configuration → Google Analytics: GA4
Event**.

1. **Measurement ID:** your `G-…` id. The panel should say *"Google tag found in this
   container"*.
2. **Event Name:** `purchase`
3. **Event Parameters → Add parameter**, one row each:

   | Event Parameter | Value |
   |---|---|
   | `transaction_id` | `{{Order Number}}` |
   | `value` | `{{Clean Grand Total}}` |
   | `currency` | `USD` |
   | `refer_source` | `{{Refer Source}}` |
   | `customer_number` | `{{Customer Number}}` |
   | `cookie_fbc` | `{{cookie_fbc}}` |
   | `cookie_fbp` | `{{cookie_fbp}}` |
   | `fbclid` | `{{cookie_fbclid}}` |

4. **More Settings → Ecommerce:** tick **Send Ecommerce data**, **Data source**
   **Custom Object**, **Ecommerce Object** `{{EE - Purchase Object}}`.
5. Leave **Include user-provided data from your website** off.
6. **Triggering:** `DOM Ready - Order Confirmation` (Step 7).
7. Name it `GA4 - Event - Scrape Purchase`, folder `Order Summary Scrape`, **Save**.

> ⚠️ **`value` must be the clean number.** With `{{Grand Total}}` the tag sent
> `value: "$0.00"` and GA4 recorded no revenue.

> ⚠️ **Parameter names are lowercase with underscores** and must match the custom
> dimensions in Step 11 character for character. A dimension registered as
> `refer_source` gets nothing from a parameter called `source`; that mismatch is why
> source was "not being sent" in this build.

✅ **Check:** Preview, place a test order. In Tag Assistant click your GA4 id at the
top, then the **purchase** event: the *API Call* shows
`gtag("event", "purchase", { currency: "USD", items: [...], transaction_id: …,
value: …, refer_source: … })` and **Hits Sent** shows **Purchase**.

### Step 9: Meta pixel base code

About 5 minutes.

**9a.** First check whether the pixel is already on the site: dev tools → **Network**,
filter `fbevents`. If `fbevents.js` loads on the confirmation page without this tag,
**skip this step**; a second base code sends every PageView twice.

**9b.** Otherwise: **Tags → New → Custom HTML**, paste in **all** of
[`tags/meta-pixel-base.html`](tags/meta-pixel-base.html), and replace
`YOUR_PIXEL_ID` in **both** places with your dataset id (Events Manager → **Data
sources** → your pixel → the number under its name). **Triggering → All Pages**. Name
it `Meta Pixel - Base`, **Save**.

> ⚠️ **No "Facebook Pixel" tag type.** It isn't in the picker. Some guides tell you to
> choose it; use Custom HTML.

✅ **Check:** Preview any page; `Meta Pixel - Base` is under **Tags Fired**, and the
Meta Pixel Helper extension (if installed) shows a PageView.

### Step 10: Meta Purchase event

About 10 minutes.

**10a.** **Tags → New → Tag Configuration → Custom HTML**. Paste in **all** of
[`tags/meta-purchase-order-confirmation.html`](tags/meta-purchase-order-confirmation.html).

| In the code | GTM variable | Sent to Meta as |
|---|---|---|
| `value` | `{{Clean Grand Total}}` | the order total, a number |
| `currency` | fixed `'USD'` | currency |
| `order_id` | `{{Order Number}}` | custom data |
| `eventID` (4th argument) | `{{Order Number}}` | the event id, for de-duplication |

**10b. Advanced Settings → Tag Sequencing:** tick **Fire a tag before
FB Purchase - Order Confirmation fires** and pick `Meta Pixel - Base` (or skip this
if the base code is in the site template).

**10c. Triggering:** `DOM Ready - Order Confirmation`. Name it
`FB Purchase - Order Confirmation`, folder `Order Summary Scrape`, **Save**.

> ⚠️ **Remove the checkout's own Purchase call first.** If the site already runs
> `fbq('track', 'Purchase')` (that was the one with the missing value), turn it off
> when this goes live, or every order counts twice. In dev tools, search the
> confirmation page source for `'Purchase'`.

> ⚠️ **Where the extra fields go.** The first draft of this tag put `eventID`, `fbp`,
> `fbc`, `em` and `external_id` inside the event data. Meta ignores them there: the
> event id belongs in the 4th argument, `_fbp` / `_fbc` are read from the cookies by
> the pixel itself (which is why Step 6 writes `_fbc` in Meta's format), and advanced
> matching fields (`em`, `external_id`) go in `fbq('init', …)`. This checkout shows no
> email on the confirmation page, so none is sent.

> ⚠️ **Free orders send value 0.** Meta's diagnostics flag a Purchase with a value of
> 0. If you sell free registrations through the same checkout, add a trigger
> exception (or a condition `Clean Grand Total` **greater than** `0`) so only paid
> orders send Purchase.

✅ **Check:** Events Manager → your pixel → **Test events** (wording may differ),
open your site from there, place a test order. A **Purchase** appears with `value`,
`currency` and `order_id`, and Meta stops listing *"Value field is missing"* for new
events within a few days.

### Step 11: Register the GA4 custom dimensions

About 10 minutes.

GA4 drops custom parameters from reports until each one is registered.

**11a.** GA4 → **Admin → Custom definitions → Create custom dimension**. One per row:

| Dimension name | Scope | Event parameter |
|---|---|---|
| `Refer Source` | Event | `refer_source` |
| `Customer Number` | Event | `customer_number` |
| `cookie_fbc` | Event | `cookie_fbc` |
| `cookie_fbp` | Event | `cookie_fbp` |
| `fbclid` | Event | `fbclid` |

`transaction_id`, `value` and `currency` are built in (*Transaction ID*, *Purchase
revenue*); don't register them.

> ⚠️ **New dimensions only fill from now on, and take up to 24 hours.** An Explore
> report showing *"No data available"* the morning after is usually this, not a
> broken tag. Check **DebugView** (Step 12) for same-day proof.

✅ **Check:** the next day, **Explore → Blank → Free form**, dimensions **Transaction
ID**, **Refer Source**, **cookie_fbc**, metric **Purchase revenue**, filter **Event
name exactly matches purchase**: one row per order.

### Step 12: Test, publish, and prove the days-later match

About 20 minutes, plus a few days for the last check.

**12a. Preview end to end.** **Preview**, open a landing page with
`?fbclid=test123&utm_source=test`, browse to checkout, place a test order. On the
confirmation page's **DOM Ready** event, **Tags Fired** shows
`GA4 - Event - Scrape Purchase` and `FB Purchase - Order Confirmation`.

**12b. DebugView.** GA4 → **Admin → Data display → DebugView** (wording may differ). Events from a Tag Assistant preview
session appear there on their own; you should see `purchase` with your parameters.
If nothing arrives, open the **Google Tag** from Step 2 → **Configuration settings**
→ add parameter `debug_mode` = `true` (wording may differ), preview again, and remove
it before publishing.

**12c. Publish.** **Submit**, version name `GA4 + Meta purchase from confirmation
page`, **Publish**.

**12d. Prove the days-later match.** This is the point of Step 6.

| Check | Where | Pass |
|---|---|---|
| Click id arrives | land from a real Meta ad (or `?fbclid=`) | `fbclid` in the URL |
| Cookie written | dev tools → Application → Cookies | `_fbc` = `fb.1.…` |
| Survives the gap | close the browser, come back a day or more later by typing the address, order | no `fbclid` in any URL |
| Reaches the order | GA4 Explore or Looker Studio, by Transaction ID | `cookie_fbc` filled for that order |

An order with `cookie_fbc` filled and `Refer Source` = `direct` is the proof: the
visit carried no campaign, but the ad click was kept.

**12e. Optional report.** In Looker Studio, a GA4 data source and a table with
**Transaction ID**, **Customer Number**, **Date hour and minute**, **Refer Source**,
**cookie_fbp**, **fbclid**, **cookie_fbc** and **Purchase revenue** gives an
order-by-order view to check against Meta's attributed purchases.

✅ **Check:** the report lists every order of the day with its total, and orders that
came from Meta ads carry a `cookie_fbc` value.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Purchase tag **Not Fired**, red ✗ on a `gtm.js equals gtm.dom` row | An impossible extra trigger condition | [Step 7](#step-7-the-order-confirmation-trigger) |
| `Order Number` or `Grand Total` empty in Preview | Tag fired before the page loaded, or the element id differs | [Step 7](#step-7-the-order-confirmation-trigger) (DOM Ready), [Step 3](#step-3-dom-element-variables-for-the-order-fields) |
| GA4 `value: "$0.00"` / no revenue | Raw text sent instead of the clean number | [Step 4](#step-4-clean-the-money-values), [Step 8](#step-8-ga4-purchase-from-the-page) |
| Submit fails: *"…ECMASCRIPT_2015 mode or better: const declaration"* | `const` / `let` in a Custom JavaScript variable | [Step 5](#step-5-the-source-variable) |
| Parameter sent but never in reports | Not registered, or the name differs in case or spelling | [Step 11](#step-11-register-the-ga4-custom-dimensions) |
| Explore says *No data available* | Dimension registered less than 24 hours ago | [Step 11](#step-11-register-the-ga4-custom-dimensions), then DebugView |
| `purchase` fires in Tag Assistant but not in DebugView | Not a preview session, or the Google tag lacks debug mode | [Step 12](#step-12-test-publish-and-prove-the-days-later-match) |
| Can't find "GA4 Configuration" or "Facebook Pixel" tag types | Neither exists in the picker | [Step 2](#step-2-make-sure-a-google-tag-is-in-the-container), [Step 9](#step-9-meta-pixel-base-code) |
| `fbclid` column empty, `cookie_fbc` filled | Meta never keeps the raw click id | [Step 6](#step-6-keep-metas-click-id-in-cookies) |
| Purchases doubled in Meta | The checkout's own Purchase is still running | [Step 10](#step-10-meta-purchase-event) |
| Meta still says *Value field is missing* | Free orders sending 0, or events older than the fix | [Step 10](#step-10-meta-purchase-event) |

## Limits

- **Browser only.** Ad blockers, and Safari's limits on cookies set by script, cut
  both the pixel and the 90-day cookie. Server-side Conversions API would close the
  gap but needs back-end work this build avoided.
- **It reads the page.** A redesign of the confirmation page that renames element
  ids silently empties the variables. Re-run the Step 3 check after any site
  release.
- **First line item only** in the GA4 items list (Step 3). Totals are unaffected.
- **Source from UTMs is weak here.** `Refer Source` reads only the confirmation URL.
  To report orders by campaign, keep the UTMs in a cookie on landing, the same way
  Step 6 keeps `fbclid`.
- **Meta's Purchase was not confirmed firing live in the build records.** The GA4
  purchase and the click-id cookies ran on real orders (a full day of orders with
  totals and `_fbc` values in the report); the records don't show the Meta Purchase
  tag firing on a live order. Run the Step 10 check before trusting it.

## Security and privacy

- Nothing here is a secret: container ids, measurement ids and pixel ids are public
  on every page they run on.
- Send **no names, emails or phone numbers to GA4.** That's why the Bill To variable
  is left out (Step 3).
- `_fbc`, `fbclid` and the order data are first-party data under your privacy
  policy. If you need consent before marketing cookies, put Steps 6, 9 and 10 behind
  your consent trigger.

---

Built by [Jibril Sulaiman](https://github.com/carljibrilsulaimanii).
