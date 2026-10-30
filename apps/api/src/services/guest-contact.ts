import { normalizeIndianWhatsAppNumber, type GuestJoinInput } from '@studyroom/shared';

export function normalizeGuestContact(input: Pick<GuestJoinInput, 'email' | 'whatsappNumber' | 'whatsappConsent'>) {
  const whatsappNumber = input.whatsappNumber ? normalizeIndianWhatsAppNumber(input.whatsappNumber) : null;
  return {
    email: input.email?.trim().toLowerCase() ?? null,
    whatsappNumber,
    whatsappConsent: Boolean(whatsappNumber && input.whatsappConsent),
  };
}
