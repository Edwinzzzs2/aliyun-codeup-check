import { 
  validateRequiredParams, 
  extractSearchParams, 
  makeCodeupApiRequest 
} from '../utils.js';

export async function GET(request) {
  // 提取查询参数（按照阿里云“查询提交列表”接口定义）
  const params = extractSearchParams(request, [
    'token', 'orgId', 'repoId', 'refName', 'since', 'until', 'page', 'perPage', 'path', 'search', 'showSignature', 'committerIds', 'search'
  ]);

  // 验证必填参数：token、orgId、repoId、refName
  const validationError = validateRequiredParams(params, ['token', 'orgId', 'repoId', 'refName']);
  if (validationError) {
    return validationError;
  }

  // 构建 API 基础URL（不附带查询参数，交由通用方法统一拼接）
  const url = `https://openapi-rdc.aliyuncs.com/oapi/v1/codeup/organizations/${params.orgId}/repositories/${params.repoId}/commits`;

  // 使用公共函数发起请求（附带允许的查询字段，并解析分页响应头）
  return makeCodeupApiRequest({
    url,
    token: params.token,
    queryParams: params,
    allowedQueryFields: ['refName', 'since', 'until', 'page', 'perPage', 'path', 'search', 'showSignature', 'committerIds', 'search'],
    includePagination: true
  });
}
