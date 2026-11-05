"use client";

import { FiModal } from "./Modal";
import { FiButton } from "./ui";

/**
 * An action whose modal only shows something (`->modalSubmitAction(false)`): here an
 * email, sandboxed in an iframe, with one button back.
 */
export function FiPreviewModal({ heading, html, backLabel, closeLabel, onClose }: { heading: string; html: string; backLabel: string; closeLabel: string; onClose: () => void }) {
  return (
    <FiModal
      open
      onClose={onClose}
      heading={heading}
      width="4xl"
      closeLabel={closeLabel}
      footer={
        <FiButton color="gray" onClick={onClose}>
          {backLabel}
        </FiButton>
      }
    >
      <iframe sandbox="" className="h-[70vh] w-full rounded-lg border border-gray-200" srcDoc={html} />
    </FiModal>
  );
}
