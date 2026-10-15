function() {
  /*
    refer-source.js -- GTM Custom JavaScript variable "Refer Source"
    Author:  Jibril Sulaiman
    Created: 2026-10-15 (from a production build first shipped May 2025)
    Deploy:  Tag Manager > Variables > User-Defined Variables > New >
             Custom JavaScript. Name it exactly: Refer Source
    What:    Returns utm_source from the CURRENT page's URL, or "direct".
             Sent to GA4 as the refer_source event parameter.
    Why:     Gives each purchase a source without a data layer.
             Limit: it reads only the confirmation page's own URL. A buyer who
             landed with UTMs and then clicked through the cart arrives at the
             confirmation page without them, so most real orders read "direct".
             See the README's Limits section.
             The first version used const and the container would not publish
             ("This language feature is only supported for ECMASCRIPT_2015 mode
             or better: const declaration"). GTM variables are ES5: var only.
  */
  var params = new URLSearchParams(window.location.search);
  return params.get('utm_source') || 'direct';
}
