/**
 * Blocks disposable / throwaway email domains and suspicious local-part patterns.
 * Validation must run server-side so it cannot be bypassed from the browser.
 */

const DISPOSABLE_DOMAINS = new Set([
  // Mailinator family
  "mailinator.com", "mailinater.com", "mailinator2.com", "mailinator.net",
  "suremail.info", "spamgourmet.com", "spamgourmet.net", "spamgourmet.org",
  // Guerrilla Mail
  "guerrillamail.com", "guerrillamail.net", "guerrillamail.org",
  "guerrillamail.de", "guerrillamail.info", "guerrillamailblock.com",
  "grr.la", "sharklasers.com", "guerrillamailblock.com", "spam4.me",
  // Temp-mail / 10-minute mail
  "temp-mail.org", "tempmail.com", "tempmail.net", "tempmail.us",
  "10minutemail.com", "10minutemail.net", "10minutemail.org",
  "10mail.org", "10minutemail.de", "10minutemail.co.uk",
  // Throwam / Trashmail
  "throwam.com", "throwam.net", "trashmail.at", "trashmail.com",
  "trashmail.io", "trashmail.me", "trashmail.net", "trashmail.org",
  "trashmailer.com", "trashcanmail.com",
  // Yopmail
  "yopmail.com", "yopmail.fr", "cool.fr.nf", "jetable.fr.nf",
  "nospam.ze.tc", "nomail.xl.cx", "mega.zik.dj", "speed.1s.fr",
  "courriel.fr.nf", "moncourrier.fr.nf", "monemail.fr.nf", "monmail.fr.nf",
  // Maildrop / Discard
  "maildrop.cc", "discard.email", "discardmail.com", "discardmail.de",
  "mailnull.com", "mailnull.net",
  // Fake/test domains commonly used
  "example.com", "example.net", "example.org", "test.com",
  "fake.com", "noemail.com", "noemail.net", "noemail.org",
  // Spamex / other well-known
  "spamex.com", "spam.la", "spam.la", "spamfree24.org",
  "filzmail.com", "filzmail.de",
  "cuvox.de", "dayrep.com", "einrot.com", "fleckens.hu",
  "gustr.com", "jourrapide.com", "rhyta.com", "superrito.com",
  "teleworm.us", "armyspy.com",
  // Mohmal / Fakeinbox
  "mohmal.com", "fakeinbox.com", "fakeinbox.net",
  // Gish / Mailnesia
  "mailnesia.com", "mailnull.com", "mailsiphon.com",
  // Getairmail / Jetable
  "getairmail.com", "jetable.com", "jetable.net", "jetable.org",
  // Burner mail services
  "burnermail.io", "inboxbear.com", "mytemp.email",
  "tempinbox.com", "tempinbox.co.uk",
  // Sharklasers / GuerrillaMail aliases
  "aaathats3as.com", "filthyfilthy.biz", "incognitomail.com",
  "incognitomail.net", "incognitomail.org",
  // Random generators
  "notmailinator.com", "spamavert.com", "antichef.com", "antichef.net",
  "hulapla.de", "instant-mail.de",
  // Mailexpire
  "mailexpire.com", "spoofmail.de",
  // Getnada
  "getnada.com", "nada.email",
  // Tempsky / spamspot
  "spamspot.com", "spamthisplease.com",
  // Wegwerfmail
  "wegwerfmail.de", "wegwerfmail.net", "wegwerfmail.org",
])

// Suspicious local-part patterns (the part before @)
const SUSPICIOUS_LOCAL_PATTERNS = [
  /^(test|fake|demo|dummy|noreply|no-reply|noemail|donotreply|null|none|nobody|noone|anonymous)(\d*)$/i,
  /^(johndoe|janedoe|john\.doe|jane\.doe)(\d*)$/i,
  /^(aaa+|bbb+|ccc+|xxx+|zzz+)$/i,
  /^(asdf|qwerty|abcd|1234)\d*$/i,
  /^(user|admin|test|temp|tmp)(\d{1,4})$/i,
]

export interface EmailValidationResult {
  valid: boolean
  reason?: string
}

export function validateEmailDomain(email: string): EmailValidationResult {
  const lower = email.trim().toLowerCase()

  // Must have exactly one @
  const parts = lower.split("@")
  if (parts.length !== 2) {
    return { valid: false, reason: "Invalid email format." }
  }

  const [local, domain] = parts

  if (!local || !domain) {
    return { valid: false, reason: "Invalid email format." }
  }

  // Domain must have at least one dot and valid TLD
  const domainParts = domain.split(".")
  if (domainParts.length < 2 || domainParts[domainParts.length - 1].length < 2) {
    return { valid: false, reason: "Invalid email domain." }
  }

  // Block disposable domains
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      valid: false,
      reason: "Disposable or temporary email addresses are not allowed. Please use your real email address.",
    }
  }

  // Block suspicious local parts
  for (const pattern of SUSPICIOUS_LOCAL_PATTERNS) {
    if (pattern.test(local)) {
      return {
        valid: false,
        reason: "Please use your real name and email address to register.",
      }
    }
  }

  return { valid: true }
}
