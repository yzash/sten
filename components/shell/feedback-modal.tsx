"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PERSONAS } from "@/lib/personas";
import { useStore } from "@/lib/store";

export function FeedbackModal() {
  const open = useStore((s) => s.flagOpen);
  const setOpen = useStore((s) => s.setFlagOpen);
  const add = useStore((s) => s.addFeedback);
  const persona = useStore((s) => s.persona);
  const path = usePathname();
  const [wrong, setWrong] = useState("");
  const [missing, setMissing] = useState("");
  const [owner, setOwner] = useState("");
  const close = () => setOpen(false);
  const submit = () => {
    add({ screen: path, wrong, missing, owner });
    setWrong("");
    setMissing("");
    setOwner("");
    close();
  };
  return (
    <Modal
      open={open}
      onClose={close}
      kicker="Flag this screen"
      title="What should change here?"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!wrong && !missing && !owner} data-testid="feedback-save">
            Save note
          </Button>
        </>
      }
    >
      <div className="mb-4 flex gap-6 text-[12.5px]">
        <div>
          <div className="label">Screen</div>
          <div className="mono">{path}</div>
        </div>
        <div>
          <div className="label">Persona</div>
          <div>{PERSONAS[persona].name}</div>
        </div>
      </div>
      <div className="space-y-3.5">
        <Field label="What is wrong">
          <Textarea value={wrong} onChange={(e) => setWrong(e.target.value)} placeholder="This is not how we triage, the number is off, the step is missing" data-testid="feedback-wrong" />
        </Field>
        <Field label="What is missing">
          <Textarea value={missing} onChange={(e) => setMissing(e.target.value)} placeholder="Data, a check, an approver, a system" />
        </Field>
        <Field label="Who would own this">
          <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Role or team" />
        </Field>
      </div>
      <p className="mt-3 text-[12px] text-ink-3">Notes stay in this browser and export as CSV from Feedback.</p>
    </Modal>
  );
}
