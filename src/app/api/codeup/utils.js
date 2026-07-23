/**
 * 阿里云 Codeup API 通用请求处理工具
 */
import { AutoMergeDB } from '../../../../lib/database.supabase';

function getRequestClientInfo(request) {
  if (!request?.headers) return null;

  const forwardedFor = request.headers.get('x-forwarded-for');
  return {
    ip: forwardedFor?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '未知 IP',
    userAgent: request.headers.get('user-agent') || '未知客户端',
  };
}

function sanitizeParams(params) {
  // Token、密钥等认证信息严禁写入异常日志。
  return Object.fromEntries(
    Object.entries(params || {}).filter(([key]) => (
      !/(token|authorization|password|secret)/i.test(key)
    ))
  );
}

async function logCodeupApiException({
  apiName,
  method,
  fullUrl,
  queryParams,
  request,
  message,
  responseData,
  error,
}) {
  try {
    const endpoint = new URL(fullUrl).pathname;
    const cause = error?.cause;
    const errorDetails = [
      error?.message,
      cause?.code,
      cause?.message,
    ].filter(Boolean).join(' | ') || null;

    await AutoMergeDB.logDetailedExecution({
      taskName: apiName || `${method} ${endpoint}`,
      status: 'failed',
      message,
      requestData: {
        method,
        endpoint,
        queryParams: sanitizeParams(queryParams),
        clientInfo: getRequestClientInfo(request),
      },
      responseData: responseData || null,
      errorDetails,
      executionType: 'api_exception',
    });
  } catch (logError) {
    // 记录日志失败不能覆盖原接口异常，否则客户端会看到错误的失败原因。
    console.error('[Codeup API] 异常日志写入失败:', logError);
  }
}

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
 * 优先从请求头读取 Token，并保留旧调用的回退值以兼容服务端内部请求。
 */
export function getRequestToken(request, fallbackToken = null) {
  return request.headers.get("x-yunxiao-token") || fallbackToken;
}

/**
 * Sends a Codeup request directly or through the configured authenticated proxy.
 * These variables are server-only and must not use the NEXT_PUBLIC_ prefix.
 */
export async function fetchCodeup(url, options = {}) {
  const proxyUrl = process.env.CODEUP_PROXY_URL?.trim().replace(/\/+$/, "");
  if (!proxyUrl) {
    return fetch(url, options);
  }

  const proxyToken = process.env.CODEUP_PROXY_TOKEN?.trim();
  if (!proxyToken) {
    throw new Error("CODEUP_PROXY_TOKEN is required when CODEUP_PROXY_URL is configured");
  }

  const headers = new Headers(options.headers);
  headers.set("X-Proxy-Token", proxyToken);

  return fetch(`${proxyUrl}/${url}`, {
    ...options,
    headers,
  });
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

const MAX_ERROR_BODY_LOG_LENGTH = 1000;

function sanitizeLogText(value) {
  return String(value || "")
    .replace(/pt-[A-Za-z0-9_-]+/g, "[REDACTED_TOKEN]")
    .slice(0, MAX_ERROR_BODY_LOG_LENGTH);
}

function sanitizeUrlForLog(value) {
  try {
    const safeUrl = new URL(value);
    for (const name of safeUrl.searchParams.keys()) {
      if (/token|authorization/i.test(name)) {
        safeUrl.searchParams.set(name, "[REDACTED]");
      }
    }
    return safeUrl.toString();
  } catch {
    return sanitizeLogText(value);
  }
}

function createTraceId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getErrorCauseDetails(error) {
  const cause = error?.cause;
  const nestedErrors = Array.isArray(cause?.errors)
    ? cause.errors.slice(0, 5).map((nestedError) => ({
        name: nestedError?.name || null,
        code: nestedError?.code || nestedError?.errno || null,
        message: sanitizeLogText(nestedError?.message),
      }))
    : [];

  return {
    causeName: cause?.name || null,
    causeCode: cause?.code || cause?.errno || null,
    causeMessage: sanitizeLogText(cause?.message),
    causeErrors: nestedErrors,
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
 * @param {Request} config.request - 当前客户端请求，用于记录来源
 * @param {string} config.apiName - 异常页展示的接口名称
 * @returns {Response} - API响应
 */
export async function makeCodeupApiRequest({
  url,
  token,
  queryParams = {},
  allowedQueryFields = [],
  includePagination = false,
  request = null,
  apiName = '',
  method = 'GET',
}) {
  const traceId = createTraceId();
  const startedAt = Date.now();
  let fullUrl = url;
  let logUrl = sanitizeUrlForLog(url);
  let upstreamStatus = null;
  let upstreamRequestId = null;
  let upstreamContentType = null;
  let responseBodyPreview = null;

  try {
    // 构建完整URL
    const queryString = buildQueryString(queryParams, allowedQueryFields);
    fullUrl = queryString ? `${url}?${queryString}` : url;
    logUrl = sanitizeUrlForLog(fullUrl);

    console.info("[CodeUp API] request", {
      traceId,
      url: logUrl,
      page: queryParams.page || null,
      perPage: queryParams.perPage || null,
      sort: queryParams.sort || null,
      hasSearch: Boolean(queryParams.search),
    });

    // 发起请求
    const response = await fetchCodeup(fullUrl, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-yunxiao-token": token,
      },
    });

    upstreamStatus = response.status;
    upstreamRequestId = response.headers.get("x-request-id");
    upstreamContentType = response.headers.get("content-type");

    const responseText = await response.text();
    responseBodyPreview = sanitizeLogText(responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("[CodeUp API] invalid JSON response", {
        traceId,
        url: logUrl,
        status: upstreamStatus,
        durationMs: Date.now() - startedAt,
        upstreamRequestId,
        contentType: upstreamContentType,
        responseBodyPreview,
        error: parseError.message,
      });
      throw new Error(`上游响应不是有效 JSON: ${parseError.message}`);
    }

    // 如果请求失败，返回标准化的错误响应
    if (!response.ok) {
      const details = sanitizeLogText(
        data.errorDescription || data.errorMessage || data.message || '未知错误'
      );
      console.error("[CodeUp API] upstream error", {
        traceId,
        url: logUrl,
        status: upstreamStatus,
        durationMs: Date.now() - startedAt,
        upstreamRequestId,
        contentType: upstreamContentType,
        responseBodyPreview,
      });

      await logCodeupApiException({
        apiName,
        method,
        fullUrl,
        queryParams,
        request,
        message: `Codeup 接口返回 HTTP ${response.status}：${details}`,
        responseData: {
          status: upstreamStatus,
          requestId: upstreamRequestId,
          bodyPreview: responseBodyPreview,
          traceId,
          durationMs: Date.now() - startedAt,
        },
      });

      return new Response(
        JSON.stringify({
          error: 'API请求失败',
          errorDescription: data.errorDescription,
          errorMessage: data.errorMessage,
          details
        }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.info("[CodeUp API] success", {
      traceId,
      url: logUrl,
      status: upstreamStatus,
      durationMs: Date.now() - startedAt,
      upstreamRequestId,
    });

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
    console.error("[CodeUp API] request exception", {
      traceId,
      url: logUrl,
      status: upstreamStatus,
      durationMs: Date.now() - startedAt,
      upstreamRequestId,
      contentType: upstreamContentType,
      responseBodyPreview,
      error: sanitizeLogText(error?.message),
      ...getErrorCauseDetails(error),
    });

    await logCodeupApiException({
      apiName,
      method,
      fullUrl,
      queryParams,
      request,
      message: `Codeup 网络请求失败：${error.message}`,
      error,
    });

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
  const headerToken = getRequestToken(request);
  
  paramNames.forEach(name => {
    params[name] = name === "token"
      ? headerToken || searchParams.get(name)
      : searchParams.get(name);
  });
  
  return params;
}
