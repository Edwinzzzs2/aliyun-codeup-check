import { 
  validateRequiredParams, 
  extractSearchParams, 
  makeCodeupApiRequest 
} from '../utils.js';

export async function GET(request) {
  // 提取查询参数
  const params = extractSearchParams(request, ['token', 'orgId']);

  // 验证必填参数
  const validationError = validateRequiredParams(params, ['token', 'orgId']);
  if (validationError) {
    return validationError;
  }

  // 构建API URL
  const url = `https://openapi-rdc.aliyuncs.com/oapi/v1/codeup/organizations/${params.orgId}/repositories`;

  // 使用公共函数发起请求
  return makeCodeupApiRequest({
    url,
    token: params.token,
    queryParams: params,
    allowedQueryFields: [],
    includePagination: true
  });
}
