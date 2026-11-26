# Zaure Admin & RBAC Security Specification (Phase 0)

## 1. Data Invariants
1. **Default Least Privilege (`USER`)**: Every authenticated user has no `/admins/{uid}` record by default and can only mutate their own user profile with `role in ['utilisateur', 'mentor', 'verifie']` unchanged on self-updates.
2. **Non-Self-Elevation**: No user (`USER`, `MODERATOR`, `ADMIN`) can create or modify their own `/admins/{uid}` record to acquire or upgrade a role (`SUPER_ADMIN`, `ADMIN`, `MODERATOR`). Only the verified bootstrap owner (`email == 'mahamadougarbamoussa8080@gmail.com' && email_verified == true`) can initialize their initial `SUPER_ADMIN` record, or an existing active `SUPER_ADMIN` can assign/update other staff accounts.
3. **Immutable Audit Trail**: Every document in `/admin_audit_logs/{logId}` must carry `actorId == request.auth.uid`, must be created by active administrative staff (`isActiveStaff()`), and cannot be updated or deleted by anyone (including `SUPER_ADMIN`).
4. **Tiered PII & Configuration Protection**: Only `SUPER_ADMIN` and `ADMIN` (via `isAdmin()`) can read `/users` PII lists, modify `/user_moderation`, or update `/platform_settings`. `MODERATOR` can moderate public content (`group_posts`, `capsules`, `post_comments`, `comments`, `reports`, `group_reports`) and write `/admin_audit_logs`, without accessing private PII or managing admins.
5. **Path & Size Bounds**: Every document ID matches `^[a-zA-Z0-9_\-]+$` (`1..128`), and every payload strictly validates required keys (`hasAll`) and allowed keys (`hasOnly`).

## 2. The "Dirty Dozen" Payloads (All Must Return PERMISSION_DENIED)
1. **Self-assign SUPER_ADMIN**: Standard user calls `setDoc(doc(db, 'admins', uid), { id: uid, role: 'SUPER_ADMIN', isActive: true, ... })` -> `PERMISSION_DENIED`.
2. **Moderator promotes self to ADMIN**: `MODERATOR` calls `updateDoc(doc(db, 'admins', modUid), { role: 'ADMIN' })` -> `PERMISSION_DENIED`.
3. **Admin promotes self to SUPER_ADMIN**: `ADMIN` calls `updateDoc(doc(db, 'admins', adminUid), { role: 'SUPER_ADMIN' })` -> `PERMISSION_DENIED`.
4. **Admin creates another SUPER_ADMIN**: `ADMIN` calls `setDoc(doc(db, 'admins', targetUid), { role: 'SUPER_ADMIN', ... })` -> `PERMISSION_DENIED`.
5. **Unverified admin email spoof**: User creates account with `email == 'mahamadougarbamoussa8080@gmail.com'` with `email_verified: false` -> `PERMISSION_DENIED`.
6. **Regular user updates user profile role/shadow field**: `USER` sends `{ role: 'SUPER_ADMIN', isAdmin: true }` on `/users/{uid}` -> `PERMISSION_DENIED`.
7. **Forged audit log actorId**: Active staff creates `/admin_audit_logs/{id}` with `actorId != request.auth.uid` -> `PERMISSION_DENIED`.
8. **Tamper audit log**: `SUPER_ADMIN` attempts `updateDoc` or `deleteDoc` on `/admin_audit_logs/{id}` -> `PERMISSION_DENIED`.
9. **Moderator reads `/users` PII collection**: `MODERATOR` runs `getDocs(collection(db, 'users'))` -> `PERMISSION_DENIED`.
10. **Moderator updates `/platform_settings/global`**: `MODERATOR` attempts `setDoc(doc(db, 'platform_settings', 'global'), { maintenanceMode: true })` -> `PERMISSION_DENIED`.
11. **User writes `/platform_notifications/{id}`**: Regular user creates global broadcast notification -> `PERMISSION_DENIED`.
12. **ID Poisoning / Ghost Fields on `/user_moderation/{id}`**: Admin writes 2KB document ID or undeclared field `ghostFlag: true` -> `PERMISSION_DENIED`.

---

# Zaure Smart Algorithm Core Engine Security Specification (Phase 1)

## 3. Algorithmic Telemetry & Score Integrity Invariants
1. **Strict Telemetry Isolation (`/algorithm_events`)**: Authenticated users may ONLY create events where `userId == request.auth.uid`, and may ONLY `get`/`list` their own events (`existing().userId == request.auth.uid || isAdmin()`). Telemetry events are append-only for standard users (`update`/`delete` denied unless `isAdmin()`).
2. **Zero PII / Sensitive Data Rejection**: `algorithm_events.metadata` strictly rejects any sensitive keys (`password`, `motDePasse`, `email`, `phone`, `telephone`, `token`, `secret`, `messageContent`, `privateMessage`, `address`, `ssn`) and bounds metadata size (`<= 12` keys). Private message contents and credentials are never collected.
3. **Server-Authoritative Score Protection**: Standard users CANNOT create, update, or delete `/user_interests/{userId}`, `/content_signals/{contentId}`, or `/algorithm_user_stats/{userId}` directly. Only Cloud Functions (Admin SDK) or verified `isAdmin()` staff can write algorithmic weights, content quality/popularity scores, and user stats.
4. **Scoped Score Read Access**: `/user_interests/{userId}` and `/algorithm_user_stats/{userId}` are strictly owner-or-admin readable (`isOwner(userId) || isAdmin()`). `/content_signals/{contentId}` stores zero PII and is readable only by authenticated users (`isSignedIn()`).

## 4. Algorithmic "Dirty Dozen" Payloads (All Must Return PERMISSION_DENIED)
13. **Event User Spoofing**: `USER_A` creates `/algorithm_events/{id}` with `userId: 'USER_B'` -> `PERMISSION_DENIED`.
14. **Cross-User Event Snooping**: `USER_A` calls `getDoc` or `getDocs(query(collection(db, 'algorithm_events'), where('userId', '==', 'USER_B')))` -> `PERMISSION_DENIED`.
15. **Telemetry Tampering / Deletion**: `USER_A` calls `updateDoc` or `deleteDoc` on own `/algorithm_events/{id}` -> `PERMISSION_DENIED`.
16. **PII Injection in Metadata**: `USER_A` sends `metadata: { email: 'x@y.com' }` or `metadata: { password: '...' }` or `metadata: { messageContent: 'hello' }` -> `PERMISSION_DENIED`.
17. **Direct User Interest Manipulation**: `USER_A` writes `/user_interests/{USER_A}` to fake topic scores -> `PERMISSION_DENIED`.
18. **Direct Content Score Boosting**: `USER_A` writes `/content_signals/{postId}` to inflate `qualityScore` / `popularityScore` -> `PERMISSION_DENIED`.
19. **Direct Algorithmic Stats Manipulation**: `USER_A` writes `/algorithm_user_stats/{USER_A}` -> `PERMISSION_DENIED`.
20. **Cross-User Interest Reading**: `USER_A` reads `/user_interests/{USER_B}` or `/algorithm_user_stats/{USER_B}` -> `PERMISSION_DENIED`.
21. **Invalid Event Type / Ghost Field**: `USER_A` submits `eventType: 'unknown_action'` or undeclared top-level field `ghostScore: 999` -> `PERMISSION_DENIED`.

