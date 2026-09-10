"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export default function EmailDeliverabilityPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleTest = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/email-deliverability");
      const data = await res.json();
      toast({ title: "Suivi mis à jour", description: `Dernier envoi : ${data.lastSentAt ?? "aucun"}` });
    } catch {
      toast({ title: "Erreur", description: "Impossible de récupérer le suivi", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-card">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Email Deliverability</h1>
        <button
          onClick={handleTest}
          disabled={loading}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
        >
          {loading ? "Chargement..." : "Tester le suivi"}
        </button>
      </div>
    </div>
  );
}