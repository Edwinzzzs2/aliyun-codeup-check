/**
 * 阿里云 Codeup API 通用请求处理工具
 */

/**
 * 验证必填参数
 * @param {Object} params - 参数对象
 * @param {string[]} requiredFields - 必填字段数组
 * @returns {Response|null} - 如果验证失败返回错误响应，否则返回null
 */
export function validateRequiredParams(params, requiredFields) {
  const missingFields = requiredFields.filter(field => !params[field]);
  
  if (missingFields.length > 0) {
    return new Response(
      JSON.stringify({ 
        error: `缺少参数 ${missingFields.join('、')}` 
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
  
  return null;
}

/**
 * 构建查询参数字符串
 * @param {Object} params - 参数对象
 * @param {string[]} allowedFields - 允许的字段数组
 * @returns {string} - 查询参数字符串
 */
export function buildQueryString(params, allowedFields = []) {
  const qs = new URLSearchParams();
  
  allowedFields.forEach(field => {
    if (params[field]) {
      qs.set(field, params[field]);
    }
  });
  
  return qs.toString();
}

/**
 * 提取分页信息从响应头
 * @param {Response} response - fetch响应对象
 * @returns {Object} - 分页信息对象
 */
export function extractPaginationFromHeaders(response) {
  return {
    total: parseInt(response.headers.get('X-Total') || '0'),
    page: parseInt(response.headers.get('X-Page') || '1'),
    perPage: parseInt(response.headers.get('X-Per-Page') || '20'),
    totalPages: parseInt(response.headers.get('X-Total-Pages') || '1'),
    nextPage: response.headers.get('X-Next-Page') ? parseInt(response.headers.get('X-Next-Page')) : null,
    prevPage: response.headers.get('X-Prev-Page') ? parseInt(response.headers.get('X-Prev-Page')) : null,
  };
}

/**
 * 阿里云 Codeup API 通用请求函数
 * @param {Object} config - 配置对象
 * @param {string} config.url - API URL
 * @param {string} config.token - 认证token
 * @param {Object} config.queryParams - 查询参数对象
 * @param {string[]} config.allowedQueryFields - 允许的查询字段
 * @param {boolean} config.includePagination - 是否包含分页信息
 * @returns {Response} - API响应
 */
export async function makeCodeupApiRequest({
  url,
  token,
  queryParams = {},
  allowedQueryFields = [],
  includePagination = false
}) {
  try {
    // 构建完整URL
    const queryString = buildQueryString(queryParams, allowedQueryFields);
    const fullUrl = queryString ? `${url}?${queryString}` : url;

    // 发起请求
    const response = await fetch(fullUrl, {
      headers: {
        "Content-Type": "application/json",
        "x-yunxiao-token": token,
      },
    });

    const data = await response.json();

    // 根据配置决定是否包含分页信息
    let responseData;
    if (includePagination) {
      const pagination = extractPaginationFromHeaders(response);
      responseData = {
        result: data,
        pagination,
        total: pagination.total, // 兼容前端现有代码
        totalCount: pagination.total, // 兼容前端现有代码
      };
    } else {
      responseData = data;
    }

    return new Response(JSON.stringify(responseData), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: "网络请求失败", 
        details: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * 从请求中提取查询参数
 * @param {Request} request - Next.js请求对象
 * @param {string[]} paramNames - 参数名数组
 * @returns {Object} - 参数对象
 */
export function extractSearchParams(request, paramNames) {
  const { searchParams } = new URL(request.url);
  const params = {};
  
  paramNames.forEach(name => {
    params[name] = searchParams.get(name);
  });
  
  return params;
}