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
  const identifiers: Array<{ kind: IdentifierKind; value: string }> = [{ kind: 'client', value: input.clientId }];
  if (input.email) identifiers.push({ kind: 'email', value: input.email });
  if (input.whatsappNumber) identifiers.push({ kind: 'whatsapp', value: input.whatsappNumber });
  identifiers.sort((a, b) => `${a.kind}:${a.value}`.localeCompare(`${b.kind}:${b.value}`));

  for (const identifier of identifiers) {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`guest-profile:${identifier.kind}:${identifier.value}`]);
  }

  const matches = await client.query<{ id: string }>(`SELECT DISTINCT profile.id
    FROM guest_profiles profile
    JOIN guest_profile_identifiers identifier ON identifier.profile_id=profile.id
    WHERE ($1::text IS NOT NULL AND identifier.kind='email' AND identifier.value=$1)
       OR ($2::text IS NOT NULL AND identifier.kind='whatsapp' AND identifier.value=$2)
       OR (identifier.kind='client' AND identifier.value=$3)
    ORDER BY profile.id`, [input.email, input.whatsappNumber, input.clientId]);

  let profileId: string;
  if (matches.rows.length === 0) {
    const created = await client.query<{ id: string }>(`INSERT INTO guest_profiles(
      display_name,avatar_id,presentation,email,whatsapp_number,whatsapp_consent,last_joined_at
    ) VALUES($1,$2,$3,$4,$5,$6,now()) RETURNING id`, [
      input.displayName, input.avatarId, input.presentation ?? null, input.email,
      input.whatsappNumber, input.whatsappConsent,
    ]);
    profileId = created.rows[0]!.id;
  } else {
    profileId = matches.rows[0]!.id;
    const duplicateIds = matches.rows.slice(1).map(row => row.id);
    if (duplicateIds.length) {
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

  for (const identifier of identifiers) {
    await client.query(`INSERT INTO guest_profile_identifiers(kind,value,profile_id)
      VALUES($1,$2,$3)
      ON CONFLICT(kind,value) DO UPDATE SET profile_id=EXCLUDED.profile_id,last_seen_at=now()`, [identifier.kind, identifier.value, profileId]);
  }

  return profileId;
}
