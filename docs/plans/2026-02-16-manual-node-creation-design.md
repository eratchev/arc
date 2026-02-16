# Manual Node Creation from UI

## Summary

Add an inline form to the GraphExplorer sidebar so users can manually create nodes without leaving the graph view.

## Approach

Client-side inline form within `GraphExplorer.tsx`. Uses existing `POST /api/nodes` endpoint. No backend changes needed.

## UI

- "+ New" button below the filter input in the sidebar
- Clicking it expands an inline form (pushes type filters and node list down)
- Form fields:
  - **Title** — text input, required
  - **Type** — `<select>` dropdown with 8 node types (concept, pattern, domain, person, org, project, note, artifact), defaults to "concept"
  - **Submit / Cancel** buttons side by side
- Styled to match existing dark theme (`bg-gray-800`, `border-gray-700`, `rounded-lg`)

## Behavior

1. Click "+ New" — form appears, button hides
2. User fills title and picks type
3. Submit — `POST /api/nodes` with `{ title, type }`, slug auto-generated server-side
4. On success — `router.refresh()` to re-fetch data, form collapses, new node appears in sidebar and graph
5. On error — inline error message below form
6. Cancel — collapse form, no changes

## State

Local state in GraphExplorer:
- `showCreateForm: boolean`
- `newTitle: string`
- `newType: string` (default "concept")
- `creating: boolean` (disables submit during request)

## Files Changed

- `mos/src/components/GraphExplorer.tsx` — add form UI and state

## Not In Scope

- Editing existing nodes from the graph view
- Creating edges from the form
- Content/metadata fields (can be added on node detail page)
