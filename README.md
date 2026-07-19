# Packet Path

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
