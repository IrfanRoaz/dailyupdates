"use client";

import { useEffect, type FormEvent } from "react";

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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const values: Record<string, string> = {};
    fields.forEach((f) => {
      values[f.key] = (form.elements.namedItem(f.key) as HTMLInputElement).value.trim();
    });
    onSubmit(values);
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal postbox">
        <div className="postbox-header">
          <h2 className="hndle">{title}</h2>
        </div>
        <form className="inside" onSubmit={handleSubmit}>
          {fields.map((f) => (
            <label key={f.key}>
              {f.label}
              <input name={f.key} defaultValue={f.value} autoFocus={f === fields[0]} />
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
    </div>
  );
}
