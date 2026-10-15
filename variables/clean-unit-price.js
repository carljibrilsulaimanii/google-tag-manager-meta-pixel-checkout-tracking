function() {
  /*
    clean-unit-price.js -- GTM Custom JavaScript variable "Clean Unit Price"
    Author:  Jibril Sulaiman
    Created: 2026-10-15 (from a production build first shipped May 2025)
    Deploy:  Tag Manager > Variables > User-Defined Variables > New >
             Custom JavaScript. Name it exactly: Clean Unit Price
    What:    Same clean-up as Clean Grand Total, for the first line item's price.
             Reads the DOM Element variable "Unit Price".
    Why:     The ecommerce object's product price must be a number, not "$249.00".
             GTM compiles this as ES5: use var, never const or let.
  */
  var raw = {{Unit Price}};
  return raw ? parseFloat(raw.replace(/[^0-9.-]+/g, "")) : 0;
}
