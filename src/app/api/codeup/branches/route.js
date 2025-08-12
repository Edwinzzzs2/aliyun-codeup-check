import { 
  validateRequiredParams, 
  extractSearchParams, 
  makeCodeupApiRequest 
} from '../utils.js';

export async function GET(request) {
  // 提取所有查询参数
  const params = extractSearchParams(request, [
    'token', 'orgId', 'repoId', 'page', 'perPage', 'sort', 'search'
  ]);

  // 验证必填参数
  const validationError = validateRequiredParams(params, ['token', 'orgId', 'repoId']);
  if (validationError) {
    return validationError;
  }

  // 设置默认排序为按更新时间倒序
  if (!params.sort) {
    params.sort = 'updated_desc';
  }

  // 构建API URL
  const url = `https://openapi-rdc.aliyuncs.com/oapi/v1/codeup/organizations/${params.orgId}/repositories/${params.repoId}/branches`;

  // 使用公共函数发起请求
  return makeCodeupApiRequest({
    url,
    token: params.token,
    queryParams: params,
    allowedQueryFields: ['page', 'perPage', 'sort', 'search'],
    includePagination: true
  });
}
