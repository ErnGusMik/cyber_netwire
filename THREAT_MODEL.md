# 'Cyber Netwire' Threat Model

### Purpose
This document outlines the threat model for the Cyber Netwire chat application. It serves to identify potential security threats, vulnerabilities, and mitigation strategies to ensure the confidentiality, integrity, and availability of user data and communications. This document tries to address the widely discussed heightened security risks of end-to-end encryption on web applications.

While the project is still quite small, the possibility of active threats is close to none. However, as the project will hopefully grow and gain more users, the likelihood of being targeted by malicious actors will increase. My goal with this threat model is to identify and mitigate potential threats early in the development process, ensuring a robust security posture as the application evolves.

### Description & Scope
Cyber Netwire is an online chat application that provides end-to-end encrypted messaging between users (and in groups in the future). It is built using React for client-side functionality, Node and Express.js for server-side logic and a PostgreSQL database for data storage. The application will use the Signal protocol for encryption, ensuring that messages are only readable by the intended recipients. The application is built for use in modern web browsers, with possible future support for native desktop and mobile applications.
The scope of this threat model includes all components of the Cyber Netwire application, including the client-side interface, server-side logic, and database storage. It also considers potential threats from both external attackers and internal users.

### Security objectives
1. Ensure confidentiality of messages (no one except sender and recipient can read them).
2. Ensure message authenticity and integrity (no one can alter messages undetected).
3. Prevent unauthorized account access.
4. Protect long-term cryptographic keys from server compromise.
5. Limit metadata exposure where feasible (who talks to whom).
6. Prevent Man-in-the-Middle and malicious JS delivery attacks, that could compromise code served to clients. (This is the biggest security concern specifically for web apps, especially those using end-to-end encryption).
7. Ensure periodic key rotation and one-time pre-key consumption per Signal protocol to minimize long-term key reuse.

### System Architecture
The Cyber Netwire application consists of the following components:
1. **Client-side**: A React-based web application that handles user interactions, message encryption/decryption, and communication with the server.
2. **Server-side**: A Node.js and Express.js application that manages user authentication, message routing, and database interactions.
3. **Database**: A PostgreSQL database that stores user information, encrypted messages, and cryptographic keys.
A detailed description of the flows will be published in the near future.

### Assets and Trust Boundaries
Assets:
1. User credentials (usernames, passwords).
2. Encrypted messages.
3. Cryptographic keys (public and private keys).
4. User metadata (e.g., who is communicating with whom).

Trust Boundaries:
1. Between the client and server: All communications must be secured using HTTPS to prevent eavesdropping and tampering. This alone is not sufficient for end-to-end encryption, but it is a necessary layer.
2. Between the server and database: Secure connections must be used to protect data in transit.
3. Between browser runtime and local storage: Sensitive data should not be stored in local storage or cookies.
4. Between build pipeline and deployed code: Ensure the integrity of the code served to clients to prevent supply chain attacks.

### Possible Threat Actors
1. External attackers: Individuals or groups attempting to intercept or manipulate communications. (including nation-states)
2. Malicious insiders: Employees or contractors with access to the server or database.
3. Compromised browsers: Users' browsers that may be infected with malware or browser extensions that can read or manipulate data.
4. Supply chain attackers: Attackers who compromise the build or deployment pipeline to inject malicious code.
5. Phishers/social engineers: Attackers who trick users into revealing credentials or scanning malicious QR codes.
While these threat actors are considered, the primary focus for now is on external attackers and compromised browsers, as they pose the most significant risk to end-to-end encrypted communications in a web application context. (in my mind)

### Threats and Risks
| Threat | Description | Likelihood | Impact | Mitigation |
|--------|-------------|------------|--------|------------|
| Malicious JS delivery | Attacker compromises server/CDN and serves altered JS that exfiltrates keys. | High | Critical | Signed bundles, Content Security Policy (CSP), reproducible builds, possible future Electron client. |
| XSS attack | Injected scripts read or modify keys/messages. | Medium | High | Strict CSP, input sanitization, framework hardening. |
| Supply chain compromise | Malicious dependency in npm pipeline. | Medium | High | Lockfile signing, dependency scanning, CI isolation. |
| Database leak | Server compromise reveals message blobs. | High | Medium | Messages encrypted client-side. |
| Phishing/social engineering | User tricked into sharing credentials or scanning malicious QR. | Medium | Medium | User education, 2FA. |
| Compromised browser extension | Reads DOM or JS objects. | Medium | High | Warn users, isolate key material via WebAuthn if possible. |
| TLS compromise (MITM) | Attacker intercepts HTTPS. | Low | High | HSTS, certificate pinning, Let’s Encrypt automation. |
| Local malware | User device infected, keys stolen. | Variable | Critical | Out of scope for E2EE, user responsibility. |

### Mitigations
| Area | Mitigation | Residual Risk |
|------|------------|---------------|
| JS integrity | Signed bundles, integrity hashes, reproducible builds | Still requires trusting initial server |
| XSS | CSP (script-src 'self' 'nonce-...'), React sanitization | Possible via browser extensions |
| Supply chain | Dependency audit, lockfile, private registry | New 0-day in dependency possible |
| Key storage | WebCrypto + Argon2-encrypted IndexedDB | If browser compromised, keys can leak |
| Server | Least-privilege DB roles, rate limiting | Insider threat still possible |
| Metadata | Store minimal metadata (hashes, timestamps only) | Timing analysis possible |

### Validation
The threat model will be reviewed and updated regularly to ensure its effectiveness. This includes:
1. Regular security audits and penetration testing. (regular is a long shot, but I'll try my best while actively developing the project)
2. Monitoring user feedback and incident reports.
3. Keeping up-to-date with the latest security research and best practices. (again, while actively developing the project)

<br />
<br />
<hr />
<br />
<br />
Good god that was a lot of writing. Hope I actually wrote something useful here. ;)