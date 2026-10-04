# Cloudflare Tunnel deployment

The Mocksville ACARS Hub is published at `https://acars.ks4ec.com` through the
dedicated, remotely managed Cloudflare tunnel `acarshub-mocksville`.

The connector runs on the Hub VM and routes the public hostname to
`http://localhost:8080`. It is outbound-only; no inbound router or firewall
port is required.

## Installed files

- `/etc/systemd/system/cloudflared-acarshub.service`
- `/etc/cloudflared/acarshub-mocksville.token`
- `/usr/local/bin/cloudflared`

The token is a site-specific secret. Never store it in Git, documentation,
logs, or command-line history. The verified ownership and mode are
`root:cloudflared` and `0640`; `/etc/cloudflared` is `root:cloudflared` and
`0750`.

## Verification

```sh
systemctl is-active cloudflared-acarshub.service
systemctl is-enabled cloudflared-acarshub.service
journalctl -u cloudflared-acarshub.service -n 30 --no-pager
```

Then load both public routes and confirm live updates continue without browser
console errors:

- `https://acars.ks4ec.com/live-messages`
- `https://acars.ks4ec.com/adsb`

## Rollback

Disable the VM connector first:

```sh
sudo systemctl disable --now cloudflared-acarshub.service
```

Then remove the `acars.ks4ec.com` published-application route from the
`acarshub-mocksville` tunnel in Cloudflare. Removing the route or tunnel is a
separate externally visible change and should be confirmed before execution.
