# Bizora Invent CTF

OWASP Juice Shop v20.2.0 behind a separate password gateway, deployed on Render Free in Singapore.

Render requires CTF_ACCESS_PASSWORD (at least 20 characters) and CTF_SESSION_SECRET (at least 32 characters). Never commit these secrets. The gateway fails closed when either is missing. Open the service over HTTPS, enter the access password, then use Juice Shop normally. Gateway sessions expire after eight hours.

Tutorials and the hacking instructor are enabled. Safety mode is disabled to allow safety-restricted training challenges. Juice Shop binds only to loopback; the public gateway protects HTTP and WebSocket traffic. Gateway credentials are removed from the child application's environment.

Each deployment is an independent training instance intended for one participant. Application state can reset on restart or free-tier sleep. Do not use real personal data. Rotate access credentials after the session. Run `node test.cjs` to verify the HTTP authentication gateway.
