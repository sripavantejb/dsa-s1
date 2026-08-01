'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { DIFFICULTIES, LANGUAGES } from '@/features/leetcode-automation/constants';
import { api, qs } from '@/features/leetcode-automation/hooks/apiClient.js';
import {
  Badge,
  Button,
  Card,
  DifficultyBadge,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Skeleton,
  Textarea,
} from './ui.jsx';

const EMPTY_FORM = {
  problemName: '',
  problemUrl: '',
  language: 'cpp',
  sourceCode: '',
  difficulty: 'UNRATED',
  tags: '',
  favorite: false,
  notes: '',
};

function toForm(sol) {
  return {
    problemName: sol.problemName || '',
    problemUrl: sol.problemUrl || '',
    language: sol.language || 'cpp',
    sourceCode: sol.sourceCode || '',
    difficulty: sol.difficulty || 'UNRATED',
    tags: (sol.tags || []).join(', '),
    favorite: !!sol.favorite,
    notes: sol.notes || '',
  };
}

function fromForm(form) {
  return {
    problemName: form.problemName.trim(),
    problemUrl: form.problemUrl.trim(),
    language: form.language,
    sourceCode: form.sourceCode,
    difficulty: form.difficulty,
    tags: form.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    favorite: !!form.favorite,
    notes: form.notes,
  };
}

export function SolutionsLibrary() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [language, setLanguage] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api(
        `/api/solutions${qs({
          page,
          pageSize: 10,
          search,
          language,
          difficulty,
          favorite: favoriteOnly ? 'true' : undefined,
        })}`
      );
      setItems(data.items || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch (err) {
      toast.error(err.message || 'Failed to load solutions');
    } finally {
      setLoading(false);
    }
  }, [page, search, language, difficulty, favoriteOnly]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(sol) {
    setEditing(sol);
    setForm(toForm(sol));
    setModalOpen(true);
  }

  async function save() {
    setBusy(true);
    try {
      const payload = fromForm(form);
      if (editing) {
        await api('/api/solutions', {
          method: 'PATCH',
          body: JSON.stringify({ id: editing.id, ...payload }),
        });
        toast.success('Solution updated');
      } else {
        await api('/api/solutions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Solution saved');
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      toast.error(err.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function remove(sol) {
    if (!window.confirm(`Delete “${sol.problemName}”?`)) return;
    setBusy(true);
    try {
      await api(`/api/solutions?id=${encodeURIComponent(sol.id)}`, { method: 'DELETE' });
      toast.success('Deleted');
      await load();
    } catch (err) {
      toast.error(err.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  async function toggleFavorite(sol) {
    // Optimistic flip
    setItems((prev) =>
      prev.map((s) => (s.id === sol.id ? { ...s, favorite: !s.favorite } : s))
    );
    try {
      await api('/api/solutions', {
        method: 'PATCH',
        body: JSON.stringify({ id: sol.id, favorite: !sol.favorite }),
      });
    } catch (err) {
      setItems((prev) =>
        prev.map((s) => (s.id === sol.id ? { ...s, favorite: sol.favorite } : s))
      );
      toast.error(err.message || 'Could not update favorite');
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="m-0 text-xl font-bold tracking-tight dark:text-white">Solution library</h2>
            <p className="mt-1 mb-0 text-sm text-[var(--muted)]">
              Save solutions you already wrote. The scheduler rotates through this list.
            </p>
          </div>
          <Button onClick={openCreate}>Add solution</Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Search">
            <Input
              value={search}
              placeholder="Name or tag…"
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
          </Field>
          <Field label="Language">
            <Select
              value={language}
              onChange={(e) => {
                setPage(1);
                setLanguage(e.target.value);
              }}
            >
              <option value="all">All</option>
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Difficulty">
            <Select
              value={difficulty}
              onChange={(e) => {
                setPage(1);
                setDifficulty(e.target.value);
              }}
            >
              <option value="all">All</option>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Filter">
            <button
              type="button"
              onClick={() => {
                setPage(1);
                setFavoriteOnly((v) => !v);
              }}
              className={`mt-1.5 w-full rounded-[10px] border px-3 py-2.5 text-left text-sm font-semibold ${
                favoriteOnly
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'border-[var(--line)] bg-[#fbfdfc] text-[var(--muted)] dark:border-white/10 dark:bg-white/5'
              }`}
            >
              {favoriteOnly ? '★ Favorites only' : '☆ Show favorites only'}
            </button>
          </Field>
        </div>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No solutions yet"
          body="Add a problem you already solved so the scheduler has something to rotate."
          action={<Button onClick={openCreate}>Add your first solution</Button>}
        />
      ) : (
        <ul className="m-0 space-y-3 p-0">
          {items.map((sol) => (
            <li key={sol.id}>
              <Card className="!p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="m-0 truncate text-base font-bold dark:text-white">{sol.problemName}</h3>
                      <DifficultyBadge value={sol.difficulty} />
                      <Badge>{sol.language}</Badge>
                      {sol.favorite && <Badge tone="warn">★ favorite</Badge>}
                    </div>
                    {sol.problemUrl && (
                      <a
                        href={sol.problemUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block truncate text-xs font-semibold text-[var(--accent)]"
                      >
                        {sol.problemUrl}
                      </a>
                    )}
                    {sol.tags?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {sol.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-md bg-[#e8f0ec] px-1.5 py-0.5 font-mono text-[0.68rem] uppercase text-[var(--muted)] dark:bg-white/10"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {sol.notes && (
                      <p className="mt-2 mb-0 line-clamp-2 text-sm text-[var(--muted)]">{sol.notes}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" onClick={() => toggleFavorite(sol)} disabled={busy}>
                      {sol.favorite ? 'Unstar' : 'Star'}
                    </Button>
                    <Button variant="subtle" onClick={() => openEdit(sol)} disabled={busy}>
                      Edit
                    </Button>
                    <Button variant="danger" onClick={() => remove(sol)} disabled={busy}>
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <p className="m-0 text-sm text-[var(--muted)]">
            {total} solution{total === 1 ? '' : 's'} · page {page}/{pages}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => !busy && setModalOpen(false)}
        title={editing ? 'Edit solution' : 'Add solution'}
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy || !form.problemName.trim() || !form.sourceCode.trim()}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Problem name">
            <Input
              value={form.problemName}
              onChange={(e) => setForm((f) => ({ ...f, problemName: e.target.value }))}
              placeholder="Two Sum"
            />
          </Field>
          <Field label="Problem URL">
            <Input
              value={form.problemUrl}
              onChange={(e) => setForm((f) => ({ ...f, problemUrl: e.target.value }))}
              placeholder="https://leetcode.com/problems/…"
            />
          </Field>
          <Field label="Language">
            <Select
              value={form.language}
              onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Difficulty">
            <Select
              value={form.difficulty}
              onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tags" hint="Comma-separated">
            <Input
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder="array, hash-table"
            />
          </Field>
          <Field label="Favorite">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, favorite: !f.favorite }))}
              className={`mt-1.5 w-full rounded-[10px] border px-3 py-2.5 text-left text-sm font-semibold ${
                form.favorite
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'border-[var(--line)] bg-[#fbfdfc] text-[var(--muted)]'
              }`}
            >
              {form.favorite ? '★ Favorited' : '☆ Mark as favorite'}
            </button>
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Source code">
            <Textarea
              rows={12}
              value={form.sourceCode}
              onChange={(e) => setForm((f) => ({ ...f, sourceCode: e.target.value }))}
              placeholder="Paste your accepted solution…"
            />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Notes">
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Approach notes (optional)"
              className="!font-[Outfit]"
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
