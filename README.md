# Packet Path

Created by **Nathapon Kin**.

An interactive, classroom-ready simulation for teaching how computers find each other. It covers:

- localhost, private IPs, and public IPs
- routers, DHCP, DNS, NAT, ports, and firewalls
- safe, simulated networking commands
- how the concepts apply to Bitcoin Core ports 8333 and 8332
- a six-question knowledge check

## Run it

Open `index.html` directly in a modern browser, or serve the folder locally:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

No build step or package installation is required. The app does not send real network traffic.

## Deployment security

The site includes a restrictive in-page Content Security Policy and a Netlify-compatible
`_headers` file. When deployed on Netlify, the response headers prevent framing, MIME
sniffing, referrer leakage, unnecessary browser permissions, and connections to external
services. Keep `_headers` in the published root folder alongside `index.html`.
