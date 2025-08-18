import { validateRequiredParams } from '../utils.js';

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

    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: '创建合并请求异常', details: e.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}