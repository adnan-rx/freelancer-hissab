import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { getIntegrationSecret } from '../../common/encryption';

/** An authorization that is not completed within this window has to be restarted. */
const STATE_TTL_MS = 10 * 60_000;

interface StatePayload {
  userId: string;
  platform: string;
  /** Issued-at, epoch ms. */
  iat: number;
  nonce: string;
}

function sign(body: string): string {
  return crypto.createHmac('sha256', getIntegrationSecret()).update(body).digest('base64url');
}

/**
 * Signed, self-contained OAuth `state`.
 *
 * Binding the state to the user who started the flow is what stops an attacker
 * from luring someone into completing an authorization for an account the
 * attacker controls. It is signed rather than stored so no session table is
 * needed and it works across API instances.
 */
export function createOAuthState(userId: string, platform: string): string {
  const payload: StatePayload = {
    userId,
    platform,
    iat: Date.now(),
    nonce: crypto.randomBytes(12).toString('base64url'),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

/** Throws unless `state` was issued by us, for this user and platform, recently. */
export function verifyOAuthState(state: string, userId: string, platform: string): void {
  const [body, signature] = state.split('.');
  if (!body || !signature) {
    throw new BadRequestException('Malformed authorization state. Start the connection again.');
  }

  const expected = sign(body);
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
    throw new BadRequestException('Authorization state failed verification. Start the connection again.');
  }

  let payload: StatePayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as StatePayload;
  } catch {
    throw new BadRequestException('Malformed authorization state. Start the connection again.');
  }

  if (payload.userId !== userId || payload.platform !== platform.toLowerCase()) {
    throw new BadRequestException('This authorization was started by a different account or platform.');
  }

  if (!Number.isFinite(payload.iat) || Date.now() - payload.iat > STATE_TTL_MS) {
    throw new BadRequestException('This authorization link has expired. Start the connection again.');
  }
}
