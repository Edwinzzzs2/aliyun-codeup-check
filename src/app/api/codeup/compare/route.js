import { validateRequiredParams, makeCodeupApiRequest, extractSearchParams } from '../utils.js';

/**
 * 代码比较API - 基于阿里云GetCompare接口
 * 可获取 branch、commit 或者 tag 之间的比较内容
 */
export async function GET(request) {
  // 提取查询参数
  const params = extractSearchParams(request, [
    'token', 'orgId', 'repoId', 'from', 'to', 'sourceType', 'targetType', 'straight'
  ]);
  
  const {
    token,
    orgId,
    repoId,
    from, // 可为 CommitSHA、分支名或者标签名
    to,   // 可为 CommitSHA、分支名或者标签名
    sourceType, // 可选值：branch、tag；若是 commit 比较，可不传
    targetType, // 可选值：branch、tag；若是 commit 比较，可不传
    straight = 'false' // 是否使用 Merge-Base，默认为 false
  } = params;
  
  // 校验必填参数
  const requiredError = validateRequiredParams(
    { token, orgId, repoId, from, to },
    ['token', 'orgId', 'repoId', 'from', 'to']
  );
  if (requiredError) return requiredError;

  // 构建查询参数
  const queryParams = {
    from,
    to,
    straight
  };
  
  // 添加可选参数
  if (sourceType) queryParams.sourceType = sourceType;
  if (targetType) queryParams.targetType = targetType;

  // 目标 URL - 使用阿里云GetCompare API
  const url = `https://openapi-rdc.aliyuncs.com/oapi/v1/codeup/organizations/${orgId}/repositories/${repoId}/compares`;

  // 使用公共函数处理API请求
  return makeCodeupApiRequest({
    url,
    token,
    queryParams,
    allowedQueryFields: ['from', 'to', 'sourceType', 'targetType', 'straight'],
    includePagination: false
  });
}

/**
 * POST方法 - 支持通过请求体传递参数
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      token,
      orgId,
      repoId,
      from,
      to,
      sourceType,
      targetType,
      straight = 'false'
    } = body || {};

    // 校验必填参数
    const requiredError = validateRequiredParams(
      { token, orgId, repoId, from, to },
      ['token', 'orgId', 'repoId', 'from', 'to']
    );
    if (requiredError) return requiredError;

    // 构建查询参数
    const queryParams = {
      from,
      to,
      straight
    };
    
    // 添加可选参数
    if (sourceType) queryParams.sourceType = sourceType;
    if (targetType) queryParams.targetType = targetType;

    // 目标 URL
    const url = `https://openapi-rdc.aliyuncs.com/oapi/v1/codeup/organizations/${orgId}/repositories/${repoId}/compares`;

    // 使用公共函数处理API请求
    return makeCodeupApiRequest({
      url,
      token,
      queryParams,
      allowedQueryFields: ['from', 'to', 'sourceType', 'targetType', 'straight'],
      includePagination: false
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: '请求体解析失败', 
        details: error.message 
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}