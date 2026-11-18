# ADR 0009: Sora and Manrope typography

Status: accepted and implemented.

Sora supplies expressive display headings. Manrope supplies interface copy and tabular metric figures. JetBrains Mono is reserved for code and keyboard hints. The supplied Pulse logo remains an outlined SVG and does not change when site fonts change.

Both variable fonts are self-hosted with their licenses, preloaded from the document head, and use font-display: swap so a slow first font request cannot leave the application permanently using system fonts. Metric-adjusted Arial fallbacks reduce reflow while the fonts load. Only the two primary font families are preloaded; technical fonts load when needed.

The hierarchy uses stronger display and data weights, optical tracking, readable navigation and field labels, and consistent button/title treatments. Responsive sizes are tuned independently so the typography remains deliberate on small screens. Chart geometry, numerical values, monitoring behavior, and the supplied identity remain unchanged.

Browser checks verify that both actual font faces finish loading, exercise desktop/mobile layouts and both themes, and run accessibility checks. Lighthouse records current landing performance and layout stability rather than assuming that the font change is free.
