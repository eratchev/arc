# Manual Node Creation UI — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an inline form to the GraphExplorer sidebar so users can create nodes without leaving the graph view, built TDD-style.

**Architecture:** Extract create-node logic into a standalone async function (`createNodeFromUI`) in a new module `mos/src/lib/graph/createNodeFromUI.ts`. This keeps it testable without DOM dependencies. The GraphExplorer component calls this function and handles UI state. The function POSTs to `/api/nodes` and returns the result.

**Tech Stack:** React (Next.js 15 App Router), Tailwind CSS, Vitest, existing REST API

---

### Task 1: Write failing tests for createNodeFromUI

**Files:**
- Create: `mos/src/lib/graph/__tests__/createNodeFromUI.test.ts`

**Step 1: Write the test file**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNodeFromUI } from '../createNodeFromUI';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe('createNodeFromUI', () => {
  it('posts title and type to /api/nodes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ node: { id: '1', title: 'Redis', type: 'concept' } }),
    });

    const result = await createNodeFromUI('Redis', 'concept');

    expect(mockFetch).toHaveBeenCalledWith('/api/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Redis', type: 'concept' }),
    });
    expect(result).toEqual({ node: { id: '1', title: 'Redis', type: 'concept' } });
  });

  it('trims the title before sending', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ node: { id: '1', title: 'Redis', type: 'concept' } }),
    });

    await createNodeFromUI('  Redis  ', 'concept');

    expect(mockFetch).toHaveBeenCalledWith('/api/nodes', expect.objectContaining({
      body: JSON.stringify({ title: 'Redis', type: 'concept' }),
    }));
  });

  it('throws if title is empty or whitespace', async () => {
    await expect(createNodeFromUI('', 'concept')).rejects.toThrow('Title is required');
    await expect(createNodeFromUI('   ', 'concept')).rejects.toThrow('Title is required');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('throws with server error message on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Duplicate slug' }),
    });

    await expect(createNodeFromUI('Redis', 'concept')).rejects.toThrow('Duplicate slug');
  });

  it('throws generic message when server error has no message', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });

    await expect(createNodeFromUI('Redis', 'concept')).rejects.toThrow('Failed to create node');
  });
});
```

**Step 2: Run the tests — verify they fail**

Run: `cd /Users/evgueni/repos/personal/claude-code/arc && npx vitest run mos/src/lib/graph/__tests__/createNodeFromUI.test.ts`
Expected: FAIL — module `../createNodeFromUI` does not exist.

**Step 3: Commit**

```bash
git add mos/src/lib/graph/__tests__/createNodeFromUI.test.ts
git commit -m "test(mos): add failing tests for createNodeFromUI"
```

---

### Task 2: Implement createNodeFromUI to pass tests

**Files:**
- Create: `mos/src/lib/graph/createNodeFromUI.ts`

**Step 1: Write the implementation**

```ts
export async function createNodeFromUI(title: string, type: string) {
  const trimmed = title.trim();
  if (!trimmed) {
    throw new Error('Title is required');
  }

  const res = await fetch('/api/nodes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: trimmed, type }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error ?? 'Failed to create node');
  }

  return res.json();
}
```

**Step 2: Run the tests — verify they pass**

Run: `cd /Users/evgueni/repos/personal/claude-code/arc && npx vitest run mos/src/lib/graph/__tests__/createNodeFromUI.test.ts`
Expected: 5 tests PASS.

**Step 3: Run the full test suite**

Run: `cd /Users/evgueni/repos/personal/claude-code/arc && npx vitest run`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add mos/src/lib/graph/createNodeFromUI.ts
git commit -m "feat(mos): implement createNodeFromUI"
```

---

### Task 3: Add NODE_TYPES constant, state, and "+ New" button to GraphExplorer

**Files:**
- Modify: `mos/src/components/GraphExplorer.tsx`

**Step 1: Add the NODE_TYPES constant**

Above the `GraphExplorer` component (near `TYPE_COLORS`), add:

```tsx
const NODE_TYPES = [
  "concept", "pattern", "domain", "person", "org", "project", "note", "artifact",
] as const;
```

**Step 2: Add state variables**

At the top of `GraphExplorer` function, after the existing `useState` calls, add:

```tsx
const [showCreateForm, setShowCreateForm] = useState(false);
const [newTitle, setNewTitle] = useState("");
const [newType, setNewType] = useState("concept");
const [creating, setCreating] = useState(false);
const [createError, setCreateError] = useState("");
```

**Step 3: Add "+ New" button in the sidebar**

In the sidebar, after the search `<input>` and before the closing `</div>` of the `p-4 border-b` container, add:

```tsx
{!showCreateForm && (
  <button
    onClick={() => setShowCreateForm(true)}
    className="mt-2 w-full px-3 py-2 text-sm rounded-lg transition-colors bg-blue-600 hover:bg-blue-500 text-white"
  >
    + New
  </button>
)}
```

**Step 4: Run full test suite**

Run: `cd /Users/evgueni/repos/personal/claude-code/arc && npx vitest run`
Expected: All tests pass.

**Step 5: Commit**

```bash
git add mos/src/components/GraphExplorer.tsx
git commit -m "feat(mos): add + New button and create-node state to sidebar"
```

---

### Task 4: Add inline create form to GraphExplorer

**Files:**
- Modify: `mos/src/components/GraphExplorer.tsx`

**Step 1: Import createNodeFromUI**

At the top of the file, add:

```tsx
import { createNodeFromUI } from "@/lib/graph/createNodeFromUI";
```

**Step 2: Add the handleCreate function**

After the `toggleType` function, add:

```tsx
const handleCreate = async () => {
  setCreating(true);
  setCreateError("");
  try {
    await createNodeFromUI(newTitle, newType);
    setNewTitle("");
    setNewType("concept");
    setShowCreateForm(false);
    router.refresh();
  } catch (err) {
    setCreateError(err instanceof Error ? err.message : "Failed to create node");
  } finally {
    setCreating(false);
  }
};
```

**Step 3: Add the inline form JSX**

Right after the "+ New" button, inside the same `p-4 border-b` div, add:

```tsx
{showCreateForm && (
  <div className="mt-2 space-y-2">
    <input
      type="text"
      placeholder="Node title..."
      value={newTitle}
      onChange={(e) => setNewTitle(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") handleCreate();
        if (e.key === "Escape") {
          setShowCreateForm(false);
          setNewTitle("");
          setCreateError("");
        }
      }}
      autoFocus
      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
    <select
      value={newType}
      onChange={(e) => setNewType(e.target.value)}
      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {NODE_TYPES.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
    {createError && (
      <p className="text-xs text-red-400">{createError}</p>
    )}
    <div className="flex gap-2">
      <button
        onClick={handleCreate}
        disabled={creating || !newTitle.trim()}
        className="flex-1 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
      >
        {creating ? "Creating..." : "Create"}
      </button>
      <button
        onClick={() => {
          setShowCreateForm(false);
          setNewTitle("");
          setCreateError("");
        }}
        className="flex-1 px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
      >
        Cancel
      </button>
    </div>
  </div>
)}
```

**Step 4: Run full test suite**

Run: `cd /Users/evgueni/repos/personal/claude-code/arc && npx vitest run`
Expected: All tests pass.

**Step 5: Commit**

```bash
git add mos/src/components/GraphExplorer.tsx
git commit -m "feat(mos): add inline create-node form in sidebar"
```
