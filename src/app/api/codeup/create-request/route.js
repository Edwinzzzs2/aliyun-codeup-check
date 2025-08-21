import { validateRequiredParams, makeCodeupApiRequest, extractSearchParams } from '../utils.js';

// 查询合并请求列表 - GET
export async function GET(request) {
  // 提取查询参数
  const params = extractSearchParams(request, [
    'token', 'orgId', 'repoId', 'page', 'perPage', 'state', 'search'
  ]);
  
  const {
    token,
    orgId,
    repoId,
    page = '1',
    perPage = '20',
    state, // opened, merged, closed
    search // 标题关键字搜索
  } = params;
  
  // 校验必填参数
  const requiredError = validateRequiredParams(
    { token, orgId },
    ['token', 'orgId']
  );
  if (requiredError) return requiredError;

  // 构建查询参数
  const queryParams = {
    page,
    perPage,
    orderBy: 'updated_at', // 按更新时间排序
    sort: 'desc', // 倒序
  };
  
  // 添加可选参数
  if (repoId) queryParams.projectIds = repoId;
  if (state) queryParams.state = state;
  if (search) queryParams.search = search;

  // 目标 URL
  const url = `https://openapi-rdc.aliyuncs.com/oapi/v1/codeup/organizations/${orgId}/changeRequests`;

  // 使用公共函数处理API请求
  return makeCodeupApiRequest({
    url,
    token,
    queryParams,
    allowedQueryFields: ['page', 'perPage', 'orderBy', 'sort', 'projectIds', 'state', 'search'],
    includePagination: true
  });
}

// 创建合并请求 - POST
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      token,
      orgId,
      repoId,
      sourceBranch,
      targetBranch,
      title,
      description,
      reviewerUserIds,
      workItemIds,
      createFrom,
      sourceProjectId,
      targetProjectId,
    } = body || {};

    // 校验必填参数
    const requiredError = validateRequiredParams(
      { token, orgId, repoId, sourceBranch, targetBranch },
      ['token', 'orgId', 'repoId', 'sourceBranch', 'targetBranch']
    );
    if (requiredError) return requiredError;

    // 目标 URL（与现有接口保持一致使用 openapi-rdc 域名）
    const url = `https://openapi-rdc.aliyuncs.com/oapi/v1/codeup/organizations/${orgId}/repositories/${repoId}/changeRequests`;

    // 组装请求体（过滤掉 undefined/null 字段）
    const payload = {
      createFrom: createFrom || 'WEB',
      description,
      reviewerUserIds: Array.isArray(reviewerUserIds) ? reviewerUserIds : undefined,
      sourceBranch,
      sourceProjectId: sourceProjectId ?? repoId,
      targetBranch,
      targetProjectId: targetProjectId ?? repoId,
      title,
      workItemIds: Array.isArray(workItemIds) ? workItemIds : undefined,
    };
    const cleanedPayload = Object.fromEntries(
      Object.entries(payload).filter(([, v]) => v !== undefined && v !== null)
    );

    // 使用fetch进行POST请求（公共函数暂不支持POST请求体）
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-yunxiao-token': token,
      },
      body: JSON.stringify(cleanedPayload),
    });

    // 解析响应
    let data;
    try {
      data = await res.json();
    } catch (_) {
      data = { message: 'No JSON response body' };
    }

    // 如果请求失败，返回标准化的错误响应
    if (!res.ok) {
      return new Response(
        JSON.stringify({
          error: '创建合并请求失败',
          errorDescription: data.errorDescription,
          errorMessage: data.errorMessage,
          details: data.errorDescription || data.errorMessage || data.message || '未知错误'
        }),
        {
          status: res.status,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ 
        error: '创建合并请求异常', 
        errorDescription: '创建合并请求时发生异常',
        errorMessage: e.message,
        details: e.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}