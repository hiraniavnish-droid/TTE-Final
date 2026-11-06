/** Old bookmarks and saved views must not keep a removed, invisible filter. */
export function cleanLeadWorkspaceQuery(query: string): string {
  const params = new URLSearchParams(query);
  params.delete('temperature');
  if (params.get('group') === 'temperature') params.delete('group');
  return params.toString();
}
