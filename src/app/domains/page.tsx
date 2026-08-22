"use client";

import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Loading } from "@/components/Loading";
import { supabase } from "@/lib/supabase";
import { EditModal, type EditField } from "@/components/EditModal";
import { getInput } from "@/lib/forms";
import type { Domain } from "@/lib/types";

export default function DomainsPage() {
  const { domains, isAdmin, loading, commit } = useApp();
  const db = supabase();
  const [editing, setEditing] = useState<Domain | null>(null);

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = getInput(e, "name")?.value.trim();
    if (!name) return;
    const note = getInput(e, "note")?.value.trim() ?? "";
    const form = e.currentTarget;

    // sort_order at the end keeps the list order stable for new rows.
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
    // Hard delete — there is no trash/undo on this dashboard.
    if (!confirm("Delete this domain permanently?")) return;
    await commit("Could not delete", db.from("domains").delete().eq("id", id));
  }

  async function handleEditSubmit(values: Record<string, string>) {
    if (!editing) return;
    // The impressions field arrives as a string from the modal; coerce it
    // here so the integer column never receives garbage.
    const patch = {
      ...values,
      impressions_last_week: Number(values.impressions_last_week) || 0,
    };
    if (await commit("Could not update", db.from("domains").update(patch).eq("id", editing.id))) {
      setEditing(null);
    }
  }

  const editFields: EditField[] = editing
    ? [
        { key: "name", label: "Domain", value: editing.name },
        { key: "note", label: "Note", value: editing.note },
        {
          key: "impressions_last_week",
          label: "Impressions (Last Week)",
          value: String(editing.impressions_last_week),
        },
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
          <div className="table-scroll">
          <table className="wp-list-table widefat fixed striped">
            <thead>
              <tr>
                <th scope="col" className="manage-column column-primary">
                  Domain
                </th>
                <th scope="col" className="manage-column col-impressions">
                  Impressions (Last Week)
                </th>
              </tr>
            </thead>
            <tbody>
              {domains.map((d) => (
                <tr key={d.id}>
                  <td className="title column-primary">
                    <strong>{d.name}</strong>
                    {isAdmin && (
                      <div className="row-actions">
                        {/* Buttons, not href="#" links: these are actions,
                            not navigation, so they get real button semantics. */}
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => setEditing(d)}
                        >
                          Edit
                        </button>{" "}
                        |{" "}
                        <button
                          type="button"
                          className="link-button submitdelete"
                          onClick={() => handleDelete(d.id)}
                        >
                          Trash
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="col-impressions" data-label="Impressions (Last Week)">
                    {d.impressions_last_week.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
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
