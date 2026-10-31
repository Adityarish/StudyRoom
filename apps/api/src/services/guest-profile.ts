import type { PoolClient } from 'pg';

interface GuestProfileInput {
  clientId: string;
  displayName: string;
  avatarId: string;
  presentation?: string;
  email: string | null;
  whatsappNumber: string | null;
  whatsappConsent: boolean;
}

type IdentifierKind = 'client' | 'email' | 'whatsapp';

export async function resolveGuestProfile(client: PoolClient, input: GuestProfileInput) {
  const contactIdentifiers: Array<{ kind: IdentifierKind; value: string }> = [];
  const hasContactIdentifier = Boolean(input.email || input.whatsappNumber);
  if (input.email) contactIdentifiers.push({ kind: 'email', value: input.email });
  if (input.whatsappNumber) contactIdentifiers.push({ kind: 'whatsapp', value: input.whatsappNumber });
  const lockIdentifiers = [...contactIdentifiers, { kind: 'client' as const, value: input.clientId }]
    .sort((a, b) => `${a.kind}:${a.value}`.localeCompare(`${b.kind}:${b.value}`));

  for (const identifier of lockIdentifiers) {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`guest-profile:${identifier.kind}:${identifier.value}`]);
  }

  const contactMatches = await client.query<{ id: string }>(`SELECT DISTINCT profile.id
    FROM guest_profiles profile
    JOIN guest_profile_identifiers identifier ON identifier.profile_id=profile.id
    WHERE ($1::text IS NOT NULL AND identifier.kind='email' AND identifier.value=$1)
       OR ($2::text IS NOT NULL AND identifier.kind='whatsapp' AND identifier.value=$2)
    ORDER BY profile.id`, [input.email, input.whatsappNumber]);

  let matches = contactMatches.rows;
  let matchedContactlessClient = false;
  if (matches.length === 0) {
    const clientMatch = await client.query<{ id: string; display_name: string; email: string | null; whatsapp_number: string | null }>(`SELECT profile.id,profile.display_name,profile.email,profile.whatsapp_number
      FROM guest_profiles profile
      JOIN guest_profile_identifiers identifier ON identifier.profile_id=profile.id
      WHERE identifier.kind='client' AND identifier.value=$1
      ORDER BY profile.last_joined_at DESC
      LIMIT 1`, [input.clientId]);
    const existing = clientMatch.rows[0];
    if (existing && (!hasContactIdentifier || (!existing.email && !existing.whatsapp_number)) && existing.display_name.trim().toLowerCase() === input.displayName.trim().toLowerCase()) {
      matches = [{ id: existing.id }];
      matchedContactlessClient = hasContactIdentifier;
    } else if (!hasContactIdentifier) {
      const nameMatch = await client.query<{ id: string }>(`SELECT profile.id
        FROM guest_profiles profile
        JOIN guest_sessions session ON session.profile_id=profile.id
        WHERE session.client_id=$1 AND lower(trim(profile.display_name))=lower(trim($2))
        ORDER BY session.joined_at DESC
        LIMIT 1`, [input.clientId, input.displayName]);
      if (nameMatch.rows[0]) {
        matches = [{ id: nameMatch.rows[0].id }];
      }
    }
  }

  let profileId: string;
  if (matches.length === 0) {
    const created = await client.query<{ id: string }>(`INSERT INTO guest_profiles(
      display_name,avatar_id,presentation,email,whatsapp_number,whatsapp_consent,last_joined_at
    ) VALUES($1,$2,$3,$4,$5,$6,now()) RETURNING id`, [
      input.displayName, input.avatarId, input.presentation ?? null, input.email,
      input.whatsappNumber, input.whatsappConsent,
    ]);
    profileId = created.rows[0]!.id;
  } else {
    profileId = matches[0]!.id;
    const duplicateIds = matches.slice(1).map(row => row.id);
    if (duplicateIds.length) {
      const mergingIds = [profileId, ...duplicateIds];
      await client.query(`WITH ranked AS (
        SELECT id,row_number() OVER (PARTITION BY room_id ORDER BY (approval_status='approved') DESC,last_seen_at DESC,joined_at DESC,id DESC) AS position
        FROM guest_sessions WHERE profile_id=ANY($1::uuid[]) AND left_at IS NULL
      )
      UPDATE guest_sessions session SET left_at=now(),last_seen_at=now()
      FROM ranked WHERE session.id=ranked.id AND ranked.position>1`, [mergingIds]);
      await client.query('UPDATE guest_sessions SET profile_id=$1 WHERE profile_id=ANY($2::uuid[])', [profileId, duplicateIds]);
      await client.query('UPDATE guest_profile_identifiers SET profile_id=$1 WHERE profile_id=ANY($2::uuid[])', [profileId, duplicateIds]);
      await client.query('DELETE FROM guest_profiles WHERE id=ANY($1::uuid[])', [duplicateIds]);
    }
    await client.query(`UPDATE guest_profiles SET
      display_name=$2,avatar_id=$3,presentation=$4,email=COALESCE($5,email),
      whatsapp_number=COALESCE($6,whatsapp_number),
      whatsapp_consent=CASE WHEN $6::text IS NOT NULL THEN $7 ELSE whatsapp_consent END,
      updated_at=now(),last_joined_at=now()
      WHERE id=$1`, [profileId, input.displayName, input.avatarId, input.presentation ?? null, input.email, input.whatsappNumber, input.whatsappConsent]);
  }

  // A shared browser is not proof that two named/contactable guests are the
  // same person. Keep the browser identifier only for contactless profiles or
  // when a contactless profile is being upgraded with its first contact.
  const identifiers = hasContactIdentifier && !matchedContactlessClient
    ? contactIdentifiers
    : [...contactIdentifiers, { kind: 'client' as const, value: input.clientId }];
  for (const identifier of identifiers) {
    await client.query(`INSERT INTO guest_profile_identifiers(kind,value,profile_id)
      VALUES($1,$2,$3)
      ON CONFLICT(kind,value) DO UPDATE SET profile_id=EXCLUDED.profile_id,last_seen_at=now()`, [identifier.kind, identifier.value, profileId]);
  }

  return profileId;
}
