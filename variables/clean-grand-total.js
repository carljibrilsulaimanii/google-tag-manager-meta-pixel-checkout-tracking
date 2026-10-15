function() {
  /*
    clean-grand-total.js -- GTM Custom JavaScript variable "Clean Grand Total"
    Author:  Jibril Sulaiman
    Created: 2026-10-15 (from a production build first shipped May 2025)
    Deploy:  Tag Manager > Variables > User-Defined Variables > New >
             Custom JavaScript. Name it exactly: Clean Grand Total
    What:    Turns the order total scraped from the confirmation page ("$1,379.00")
             into a number (1379). Reads the DOM Element variable "Grand Total".
    Why:     The scraped text carries a "$" and commas. GA4 and Meta both need a
             plain number for value; sent as text, revenue shows as 0 or is rejected.
             GTM compiles this as ES5: use var, never const or let.
  */
  var raw = {{Grand Total}};
  return raw ? parseFloat(raw.replace(/[^0-9.-]+/g, "")) : 0;
}
