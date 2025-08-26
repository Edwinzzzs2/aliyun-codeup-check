import { 
  validateRequiredParams, 
  extractSearchParams, 
  makeCodeupApiRequest 
} from '../utils.js';

/**
 * 查询指定分支的详细信息
 * 根据阿里云 CodeUp API 文档实现
 * API 文档: https://help.aliyun.com/zh/yunxiao/developer-reference/getbranch-query-branch-information
 */
export async function GET(request) {
  // 提取所有查询参数
  const params = extractSearchParams(request, [
    'token', 'orgId', 'repoId', 'branchName', 'accessToken'
  ]);

  // 验证必填参数
  const validationError = validateRequiredParams(params, ['token', 'orgId', 'repoId', 'branchName']);
  if (validationError) {
    return validationError;
  }

  // 构建API URL - 根据最新文档格式
  // 路径格式: /oapi/v1/codeup/organizations/{organizationId}/repositories/{repositoryId}/branches/{branchName}
  const url = `https://openapi-rdc.aliyuncs.com/oapi/v1/codeup/organizations/${params.orgId}/repositories/${params.repoId}/branches/${encodeURIComponent(params.branchName)}`;

  // 使用公共函数发起请求
  return makeCodeupApiRequest({
    url,
    token: params.token,
    queryParams: params,
    allowedQueryFields: ['accessToken'], // 只有accessToken作为查询参数，branchName已在路径中
    includePagination: false // 单个分支信息不需要分页
  });
}