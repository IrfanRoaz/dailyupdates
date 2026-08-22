"use client";

import { useEffect, type FormEvent } from "react";
import { Modal } from "./Modal";
import { getInput } from "@/lib/forms";

export interface EditField {
  key: string;
  label: string;
  value: string;
}

export function EditModal({
  open,
  title = "Edit Item",
  fields,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  title?: string;
  fields: EditField[];
  onCancel: () => void;
  onSubmit: (values: Record<string, string>) => void;
}) {
  const titleId = "edit-modal-title";

  // Auto-focus the first input once the modal is in the DOM.
  useEffect(() => {
    if (!open) return;
    document.querySelector<HTMLInputElement>(".modal input")?.focus();
  }, [open, fields]);

  if (!open) return null;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values: Record<string, string> = {};
    fields.forEach((f) => {
      values[f.key] = getInput(e, f.key)?.value.trim() ?? "";
    });
    onSubmit(values);
  }

  return (
    <Modal open={open} onClose={onCancel} labelledBy={titleId}>
      <div className="modal postbox">
        <div className="postbox-header">
          <h2 id={titleId} className="hndle">
            {title}
          </h2>
        </div>
        <form className="inside" onSubmit={handleSubmit}>
          {fields.map((f) => (
            <label key={f.key}>
              {f.label}
              <input name={f.key} defaultValue={f.value} />
            </label>
          ))}
          <div className="modal-actions">
            <button type="button" className="button" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="button button-primary">
              Update
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
