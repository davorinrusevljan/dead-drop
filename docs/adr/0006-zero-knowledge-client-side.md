# Zero-knowledge: encryption happens client-side only

Protected drops are encrypted in the browser (`pbkdf2-aes256-gcm-v1`, key
derived from drop name + admin password + salt via PBKDF2, default 100k iterations).
The server stores ciphertext + `iv` + `salt` and can never decrypt: it never
sees the password or derived key, only a peppered hash for authorization.

Public drops are plaintext by user choice. `hash_algo` (`sha256`) is the
drop-ID derivation, separate from content encryption. The only supported
`encryptionAlgo` is `pbkdf2-aes256-gcm-v1` — the API rejects anything else.

**Consequence**: no server feature can ever inspect protected content (no
server-side search, moderation, or previews for encrypted drops). Crypto
lives in `packages/engine/src/crypto/`.
