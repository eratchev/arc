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
