// HASHCODE REBOOT — compatibilité historique (Struct-1).
//
// Le god-module `src/lib/mail.ts` a été découpé en :
//  - src/lib/email/transport.ts — SendEmailInput/Result, sendEmail, routage provider
//  - src/lib/email/builders.ts — sendWelcomeEmail, sendInvitationEmail, … (contenu)
// Les templates actifs en base restent dans src/lib/email-templates/.
//
// Ce fichier ne fait que ré-exporter : tout nouveau code doit importer
// directement depuis `@/lib/email/transport` ou `@/lib/email/builders`.

export * from "@/lib/email/transport";
export * from "@/lib/email/builders";
