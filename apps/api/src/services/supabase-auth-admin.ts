import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { Config } from '../config.js';
import { HttpError } from '../http/errors.js';

export interface VerifiedSupabaseUser {
  id: string;
  email: string;
}

export class SupabaseAuthAdmin {
  private readonly client: SupabaseClient | null;
  private readonly required: boolean;

  constructor(config: Pick<Config, 'NODE_ENV' | 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'>) {
    this.required = config.NODE_ENV === 'production';
    this.client = config.SUPABASE_URL && config.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : null;
  }

  get configured() { return Boolean(this.client); }

  async verifyAccessToken(authorization: string | undefined): Promise<VerifiedSupabaseUser | null> {
    if (!this.client) {
      if (this.required) throw new HttpError(503, 'SUPABASE_ADMIN_NOT_CONFIGURED', 'User login verification is temporarily unavailable.');
      return null;
    }
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) throw new HttpError(401, 'USER_LOGIN_REQUIRED', 'Sign in before joining this study room.');
    const { data, error } = await this.client.auth.getUser(token);
    if (error || !data.user?.email) throw new HttpError(401, 'USER_SESSION_INVALID', 'Your sign-in has expired. Sign in again to join.');
    return { id: data.user.id, email: data.user.email.trim().toLowerCase() };
  }

  async deleteUser(input: { id: string | null; email: string | null }) {
    if (!this.client) throw new HttpError(503, 'SUPABASE_ADMIN_NOT_CONFIGURED', 'Supabase account deletion is not configured on the server.');
    let userId = input.id;
    if (!userId && input.email) userId = (await this.findUserByEmail(input.email))?.id ?? null;
    if (!userId) return;
    const { error } = await this.client.auth.admin.deleteUser(userId);
    if (error && error.status !== 404) throw new HttpError(502, 'SUPABASE_ACCOUNT_DELETE_FAILED', 'The Supabase login could not be deleted. Try again.');
  }

  private async findUserByEmail(email: string): Promise<User | null> {
    const normalized = email.trim().toLowerCase();
    for (let page = 1; page <= 100; page += 1) {
      const { data, error } = await this.client!.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new HttpError(502, 'SUPABASE_ACCOUNT_LOOKUP_FAILED', 'The Supabase login could not be located. Try again.');
      const match = data.users.find(user => user.email?.trim().toLowerCase() === normalized);
      if (match) return match;
      if (data.users.length < 1000) return null;
    }
    throw new HttpError(409, 'SUPABASE_ACCOUNT_LOOKUP_LIMIT', 'The matching Supabase account could not be located automatically.');
  }
}
