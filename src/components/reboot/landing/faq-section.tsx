"use client";

import { RebootButton, CtaArrow, SectionHeader } from "../shared";
import { Faq } from "./faq";

export function FaqSection({
  onJoin,
  onOpenPrivacy,
}: {
  onJoin: () => void;
  onOpenPrivacy?: () => void;
}) {
  return (
    <section
      id="faq"
      className="mx-auto max-w-3xl w-full px-5 sm:px-8 py-16 sm:py-24 scroll-mt-20 cv-auto"
    >
      <SectionHeader
        index="06 · Tes questions"
        title="Tu te demandes peut-être…"
        intro="Les réponses aux questions les plus courantes sur le Reboot."
        className="mb-8"
      />
      <Faq onOpenPrivacy={onOpenPrivacy} />
      <div className="mt-8 flex justify-center">
        <RebootButton size="lg" onClick={onJoin} className="group w-full sm:w-auto">
          Construire mon profil
          <CtaArrow />
        </RebootButton>
      </div>
    </section>
  );
}
