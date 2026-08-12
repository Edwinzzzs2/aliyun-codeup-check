export function getLocalCodeupHeaders() {
  if (typeof window === 'undefined') return {};

  const token = localStorage.getItem('codeup_token') || '';
  const organizationId = localStorage.getItem('codeup_orgid') || '';
  const repositoryId = localStorage.getItem('codeup_selected_repo') || '';
  return {
    ...(token ? { 'x-yunxiao-token': token } : {}),
    ...(organizationId ? { 'x-codeup-organization-id': organizationId } : {}),
    ...(repositoryId ? { 'x-codeup-repository-id': repositoryId } : {}),
  };
}

export function codeupFetch(input, init = {}) {
  // 所有管理接口统一携带浏览器本地凭据，服务端仍会再次校验仓库读取权限。
  return fetch(input, {
    ...init,
    headers: {
      ...getLocalCodeupHeaders(),
      ...init.headers,
    },
  });
}
