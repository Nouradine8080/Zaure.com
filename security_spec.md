# Zaure Security Specification (Phase 0)

## 1. Data Invariants (Row-Level Security & Server-Side Validation)
1. **Default Deny**: Any unmatched path is denied (`allow read, write: if false`).
2. **PII Isolation**: Private accounts (`/users/{userId}`) and settings (`/user_settings/{userId}`) containing `email`, `phone`, and `utilisateurs_bloques` are readable and writable ONLY by the owning UID (`request.auth.uid == userId`) or a verified admin. Non-PII public member metadata lives in `/public_profiles/{userId}`.
3. **Identity Integrity**: On creation of `capsules`, `comments`, `reactions`, `circle_members`, `reports`, and `messages`, the author/sender/user UID field MUST equal `request.auth.uid`.
4. **Immutable Ownership & Anti-Escalation**: Users cannot reassign `auteur_id`, `sender_id`, `reporter_id`, `user_id`, or `created_at` on update, nor promote themselves to `'mentor'`/`'verifie'` after account creation (`role` is immutable by non-admins).
5. **Relational Integrity**: Comments and reactions can only be created for an existing `/capsules/{capsuleId}`. Circle memberships can only reference an existing `/circles/{circleId}`.
6. **Conversation Master Gate**: A user can ONLY read, list, update, or send/read messages inside `/conversations/{convId}` if `request.auth.uid in conversation.participant_ids`.
7. **Strict Schema & Size Guards**: Every document enforces required keys, strict allowed key allowlists (`hasOnly` / `affectedKeys().hasOnly(...)`), data types, enum values, ID regex `^[a-zA-Z0-9_\\-]+$`, and bounded string/list lengths.

## 2. Adversarial "Dirty Dozen" Payloads (Must All Return PERMISSION_DENIED)
1. **Unauthenticated Read of Private Messages**: `GET /conversations/c1/messages/m1` with `auth == null`.
2. **Cross-User PII Read**: `GET /users/victimUid` as `attackerUid`.
3. **Cross-User Settings Tampering**: `UPDATE /user_settings/victimUid` with `{ utilisateurs_bloques: [] }` as `attackerUid`.
4. **Capsule Identity Spoofing**: `CREATE /capsules/cap1` with `{ auteur_id: "victimUid", ... }` as `attackerUid`.
5. **Shadow / Ghost Field Injection**: `CREATE /public_profiles/attackerUid` with extra `{ isAdmin: true }`.
6. **Self-Privilege Escalation on Update**: `UPDATE /public_profiles/attackerUid` changing `role` from `"utilisateur"` to `"mentor"`.
7. **Orphan Comment Injection**: `CREATE /comments/com1` referencing non-existent `capsule_id: "nonexistent"`.
8. **Eavesdropping Conversation List**: `LIST /conversations` without `participant_ids array-contains request.auth.uid` or reading another user's conversation.
9. **Unauthorized Message Edit**: `UPDATE /conversations/c1/messages/m1` changing `content` as a non-sender participant.
10. **Moderation Report Snooping**: `GET /reports/rep1` as a regular user who is neither the reporter nor admin.
11. **Report Status Tampering**: `CREATE /reports/rep1` with `{ status: "traite" }` instead of `"en_attente"`.
12. **ID Poisoning / Payload Flooding**: `CREATE /capsules/<200-char-junk>` or `contenu` exceeding maximum byte/character limit.
