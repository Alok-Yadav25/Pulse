# ADR 0008: layered analytics graphics

Status: accepted and implemented.

The supplied chart reference informs a blue/cyan/teal/green visualization palette, smooth layered areas, concentric rings, percentage gauges, and gradient columns. The application keeps its existing branding and both themes. Native SVG retains the small bundle and supports keyboard exploration, explicit legends, tooltips and a data-table alternative.

Performance defaults to a stacked timing view. DNS, TCP, TLS and TTFB retain their measured values; Other is the nonnegative remainder between total and measured phase time, including transfer and overhead. Overview buckets use averages, while the percentile headline remains a separate whole-period statistic. The total-response view remains available. Smooth interpolation stays within adjacent observed values.

Health rings encode independent uptime, coverage and Apdex ratios. Audience rings encode shares of recorded page views and can switch to a donut. Top-page columns use category counts; no weekly history is synthesized from data that lacks time buckets. The six-column limit and displayed subtotal are explicit. Sample rankings allocate rounding remainder so distributions reconcile with the page-view total.

Empty datasets keep empty states. Reduced motion disables decorative transitions. Automated browser checks cover layer selection, both performance views, audience modes, bar inspection, keyboard input, responsive layout and WCAG checks in both themes.
