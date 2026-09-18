#!/usr/bin/env node
/**
 * Test script pour vérifier que l'API Brevo fonctionne correctement.
 * 
 * Ce script :
 * 1. Vérifie la présence de la clé BREVO_API_KEY
 * 2. Essaie d'envoyer un e-mail de test via l'API Brevo directement
 * 3. Affiche le résultat détaillé avec gestion d'erreurs appropriée
 */

// Vérifier la clé API
const brevoApiKey = process.env.BREVO_API_KEY;
const brevoEmailFrom = process.env.BREVO_EMAIL_FROM;

if (!brevoApiKey) {
  console.error("❌ BREVO_API_KEY non définie dans les variables d'environnement");
  console.error("💡 Ajoutez BREVO_API_KEY=votre_cle_ici à votre .env");
  process.exit(1);
}

if (!brevoEmailFrom) {
  console.error("❌ BREVO_EMAIL_FROM non définie dans les variables d'environnement");
  console.error("💡 Ajoutez BREVO_EMAIL_FROM=\"Nom <email@domaine>\" à votre .env");
  process.exit(1);
}

console.log("✅ Clé API Brevo détectée\n");

// Extraire l'expéditeur depuis BREVO_EMAIL_FROM (format "Nom <email@domaine>")
const emailMatch = brevoEmailFrom.match(/<([^>]+)>/);
const fromEmail = emailMatch ? emailMatch[1] : brevoEmailFrom;
const fromName = brevoEmailFrom.replace(/<[^>]+>/, "").trim() || "HASHCODE REBOOT";

// Préparer un e-mail de test
const testEmailPayload = {
  sender: {
    name: fromName,
    email: fromEmail
  },
  to: [
    {
      email: "eflexcloud@gmail.com"
    }
  ],
  subject: "🧪 Test API Brevo - Hashcode Reboot",
  textContent: "Ceci est un test pour vérifier que l'API Brevo fonctionne correctement.",
  htmlContent: "<p>Ceci est un test pour vérifier que l'API Brevo fonctionne correctement.</p>"
};

const brevoApiUrl = "https://api.brevo.com/v3/smtp/email";

console.log("📤 Envoi du e-mail de test via Brevo API à eflexcloud@gmail.com...\n");

fetch(brevoApiUrl, {
  method: "POST",
  headers: {
    "api-key": brevoApiKey,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(testEmailPayload),
})
  .then((response) => {
    // Gérer les statuts HTTP correctement
    if (!response.ok) {
      // Pour les erreurs 4xx/5xx, on lit le corps de la réponse
      return response.text().then((errorText) => {
        throw new Error(`Brevo API Error ${response.status}: ${errorText}`);
      });
    }
    return response.json();
  })
  .then((data) => {
    console.log("✅ Succès ! L'e-mail de test a été envoyé via l'API Brevo.\n");
    console.log("📋 Détails de la réponse :");
    console.log("   - ID du message :", data.messageId || "Non fourni");
    console.log("   - Status :", data.status || "Non fourni");
    console.log("   - Code de réponse :", data.code || "Non fourni");
    console.log("\n📋 Vérifiez la boîte de réception de eflexcloud@gmail.com");
  })
  .catch((error) => {
    console.error("❌ Erreur lors de l'appel à l'API Brevo :\n");
    console.error(`   Message : ${error.message}`);
    console.error("\n💡 Solutions possibles :");
    console.error("   1. Vérifiez que BREVO_API_KEY est correcte");
    console.error("   2. Assurez-vous que l'adresse expéditrice est validée dans Brevo");
    console.error("   3. Vérifiez votre quota d'envoi");
    console.error("   4. Vérifiez que BREVO_EMAIL_FROM est au format \"Nom <email@domaine>\"");
    console.error("   5. L'adresse eflexcloud@gmail.com doit être ajoutée à la liste des expéditeurs dans Brevo");
    process.exit(1);
  });