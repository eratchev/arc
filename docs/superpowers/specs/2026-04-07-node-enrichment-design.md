# Node Enrichment — Design Spec

**Date:** 2026-04-07
**Status:** Approved

## Problem

The MOS knowledge graph feels thin because nodes can be created manually but cannot be edited or connected after creation. The only edges that exist are those produced by SDS→MOS sync. Users have no way to manually enrich node content or express relationships between concepts they know are related.

## Goal

Allow users to edit node fields and manage connections directly from the node detail page, without leaving the page or navigating to a separate edit route.

---

## Architecture

The node detail page (`/node/[id]/page.tsx`) remains a Server Component. It fetches the node, its edges, and connected node titles on the server, then passes all data as props to a new `NodeDetail` client component.

`NodeDetail` owns all edit state and handles API calls. The page itself has no client-side logic.

```
/node/[id]/page.tsx          — Server Component (data fetch)
  └── NodeDetail.tsx          — Client Component (edit state, API calls)
```

---

## UI: Inline Edit Mode

### Read mode (current behavior, unchanged)
- Header: title + type badge + "Edit" button
- Sections: Summary, Content, Connections (grouped by edge type)
- Footer action: "Generate crib sheet"

### Edit mode (triggered by "Edit" button)
- **Title** → single-line `<input>`
- **Type** → `<select>` with 8 node types: `concept`, `pattern`, `domain`, `person`, `org`, `project`, `note`, `artifact`
- **Summary** → `<textarea>`
- **Content** → larger `<textarea>`
- **Connections** → each existing connection shows a "×" remove button; below the list, an "Add connection" row:
  - Search input with typeahead (queries `/api/search`, excludes the current node and already-connected nodes)
  - Edge type `<select>` with all supported edge types: `related_to`, `used_in`, `practiced_at`, `depends_on`, `part_of`, `connected_to`, `custom`
  - "Add" button
- **Footer** → "Save" and "Cancel" buttons (replace "Edit" button)

### State in `NodeDetail`

| Field | Type | Purpose |
|---|---|---|
| `editing` | `boolean` | toggles edit mode |
| `title` | `string` | editable copy of node title |
| `type` | `string` | editable copy of node type |
| `summary` | `string` | editable copy of node summary |
| `content` | `string` | editable copy of node content |
| `connections` | `Connection[]` | local copy of edges (add/remove reflected immediately) |
| `pendingTarget` | `Node \| null` | selected target node for new edge |
| `pendingEdgeType` | `string` | selected edge type for new edge |
| `saving` | `boolean` | disables Save during in-flight requests |
| `error` | `string \| null` | inline error message |

**Cancel** resets all state to original server-fetched values. No API calls are made.

---

## API

### Existing (no changes needed)
- `POST /api/edges` — creates an edge (`source_id`, `target_id`, `edge_type`)
- `DELETE /api/edges?id=xxx` — deletes an edge by ID

### New
**`PATCH /api/nodes/[id]`** — `mos/src/app/api/nodes/[id]/route.ts`

Request body (all fields optional):
```json
{ "title": "...", "type": "...", "summary": "...", "content": "..." }
```

Behavior:
- Authenticates via Supabase session
- Verifies the node belongs to the authenticated user
- Updates only the fields present in the request body
- Returns the updated node

Response: `{ node }` on success, `{ error }` with appropriate status on failure.

### Save behavior

On Save, `NodeDetail` fires all pending changes in parallel:
1. One `PATCH /api/nodes/[id]` if any node field changed
2. One `POST /api/edges` per added connection
3. One `DELETE /api/edges?id=xxx` per removed connection

On success: `router.refresh()` re-syncs server state, edit mode closes.
On failure: inline error shown above Save/Cancel, edit mode stays open.

---

## Error Handling

- Save failures (node update or edge mutation) show an inline error above the Save/Cancel buttons. Edit mode stays open so no work is lost.
- Typeahead search failures result in empty results — no error shown.
- Each API endpoint returns `{ error }` with a descriptive message on failure.

---

## Testing

### `PATCH /api/nodes/[id]`
- Updates provided fields and returns the updated node
- Returns 404 if the node does not belong to the authenticated user
- Returns 401 if unauthenticated
- Partial updates (only some fields provided) work correctly

### `NodeDetail` component
- "Edit" button toggles edit mode
- "Cancel" resets all state to original values without calling any API
- "Save" calls `PATCH /api/nodes/[id]` with changed fields
- "Save" calls `POST /api/edges` for each added connection
- "Save" calls `DELETE /api/edges?id=xxx` for each removed connection
- Inline error message appears when Save fails
- Edit mode remains open after a save failure

---

## Out of Scope

- Editing edges (changing edge type after creation)
- Bulk operations
- Undo/redo
- Embedding re-generation after content edit (can be added later)
