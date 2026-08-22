"use client";

import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Loading } from "@/components/Loading";
import { supabase } from "@/lib/supabase";
import { EditModal, type EditField } from "@/components/EditModal";
import type { UpcomingTask } from "@/lib/types";

export default function UpcomingPage() {
  const { upcoming, isAdmin, loading, commit } = useApp();
  const db = supabase();
  const [editing, setEditing] = useState<UpcomingTask | null>(null);

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const title = (form.elements.namedItem("title") as HTMLInputElement).value.trim();
    if (!title) return;
    const notes = (form.elements.namedItem("notes") as HTMLInputElement).value.trim();

    if (
      await commit(
        "Could not add task",
        db.from("upcoming_tasks").insert({ title, notes, sort_order: upcoming.length })
      )
    ) {
      form.reset();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Move this item to the trash?")) return;
    await commit("Could not delete", db.from("upcoming_tasks").delete().eq("id", id));
  }

  async function handleEditSubmit(values: Record<string, string>) {
    if (!editing) return;
    if (
      await commit("Could not update", db.from("upcoming_tasks").update(values).eq("id", editing.id))
    ) {
      setEditing(null);
    }
  }

  const editFields: EditField[] = editing
    ? [
        { key: "title", label: "Task", value: editing.title },
        { key: "notes", label: "Notes", value: editing.notes },
      ]
    : [];

  return (
    <>
      <h1 className="wp-heading-inline">Upcoming</h1>
      <hr className="wp-header-end" />

      {loading ? (
        <Loading label="Loading upcoming tasks…" />
      ) : (
      <>
      {upcoming.length ? (
        <table className="wp-list-table widefat fixed striped">
          <thead>
            <tr>
              <th scope="col" className="manage-column col-order">
                #
              </th>
              <th scope="col" className="manage-column column-primary">
                Task
              </th>
              <th scope="col" className="manage-column">
                Notes
              </th>
            </tr>
          </thead>
          <tbody>
            {upcoming.map((t, i) => (
              <tr key={t.id}>
                <td className="col-order">{i + 1}</td>
                <td className="title column-primary">
                  <strong>
                    <a
                      href="#"
                      className="row-title"
                      onClick={(e) => {
                        e.preventDefault();
                        if (isAdmin) setEditing(t);
                      }}
                    >
                      {t.title || "(no title)"}
                    </a>
                  </strong>
                  {isAdmin && (
                    <div className="row-actions">
                      <span className="edit">
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setEditing(t);
                          }}
                        >
                          Edit
                        </a>{" "}
                        |{" "}
                      </span>
                      <span className="trash">
                        <a
                          href="#"
                          className="submitdelete"
                          onClick={(e) => {
                            e.preventDefault();
                            handleDelete(t.id);
                          }}
                        >
                          Trash
                        </a>
                      </span>
                    </div>
                  )}
                </td>
                <td className="notes">{t.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="empty-state">No tasks found.</p>
      )}

      {isAdmin && (
        <form className="add-form" onSubmit={handleAdd}>
          <h2>Add Upcoming Task</h2>
          <input name="title" className="regular-text" placeholder="Task title" required />
          <input name="notes" className="regular-text" placeholder="Notes (optional)" />
          <button type="submit" className="button button-primary">
            <Plus />
            Add Task
          </button>
        </form>
      )}
      </>
      )}

      <EditModal
        open={Boolean(editing)}
        title="Edit Task"
        fields={editFields}
        onCancel={() => setEditing(null)}
        onSubmit={handleEditSubmit}
      />
    </>
  );
}
