"use client";

import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Loading } from "@/components/Loading";
import { supabase } from "@/lib/supabase";
import { EditModal, type EditField } from "@/components/EditModal";
import type { Domain } from "@/lib/types";

export default function DomainsPage() {
  const { domains, isAdmin, loading, commit } = useApp();
  const db = supabase();
  const [editing, setEditing] = useState<Domain | null>(null);

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
    if (!name) return;
    const note = (form.elements.namedItem("note") as HTMLInputElement).value.trim();

    if (
      await commit(
        "Could not add domain",
        db.from("domains").insert({ name, note, sort_order: domains.length })
      )
    ) {
      form.reset();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Move this item to the trash?")) return;
    await commit("Could not delete", db.from("domains").delete().eq("id", id));
  }

  async function handleEditSubmit(values: Record<string, string>) {
    if (!editing) return;
    if (await commit("Could not update", db.from("domains").update(values).eq("id", editing.id))) {
      setEditing(null);
    }
  }

  const editFields: EditField[] = editing
    ? [
        { key: "name", label: "Domain", value: editing.name },
        { key: "note", label: "Note", value: editing.note },
      ]
    : [];

  return (
    <>
      <h1 className="wp-heading-inline">Current Domains</h1>
      <hr className="wp-header-end" />

      {loading ? (
        <Loading label="Loading domains…" />
      ) : (
      <div className="postbox">
        <div className="postbox-header">
          <h2 className="hndle">Current Domains</h2>
          <span className="progress-pill">
            {domains.length} domain{domains.length === 1 ? "" : "s"}
          </span>
        </div>
        {domains.length ? (
          <ul className="domain-list">
            {domains.map((d) => (
              <li key={d.id}>
                <div className="domain-info">
                  <strong>{d.name}</strong>
                  {d.note && <span className="domain-note">{d.note}</span>}
                </div>
                {isAdmin && (
                  <span className="row-actions">
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setEditing(d);
                      }}
                    >
                      Edit
                    </a>{" "}
                    |{" "}
                    <a
                      href="#"
                      className="submitdelete"
                      onClick={(e) => {
                        e.preventDefault();
                        handleDelete(d.id);
                      }}
                    >
                      Trash
                    </a>
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-state inside-pad">No domains set.</p>
        )}

        {isAdmin && (
          <form className="add-form add-form-flush" onSubmit={handleAdd}>
            <input name="name" className="regular-text" placeholder="Domain / area" required />
            <input name="note" className="regular-text" placeholder="Note (optional)" />
            <button type="submit" className="button button-primary">
              <Plus />
              Add Domain
            </button>
          </form>
        )}
      </div>
      )}

      <EditModal
        open={Boolean(editing)}
        title="Edit Domain"
        fields={editFields}
        onCancel={() => setEditing(null)}
        onSubmit={handleEditSubmit}
      />
    </>
  );
}
