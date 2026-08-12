'use strict';

const crypto = require('crypto');
const { getRepository } = require('./pipeline.service');

const AUTH_CACHE_TTL_MS = 60 * 1000;
const authorizationCache = globalThis.__codeupAuthorizationCache || new Map();
globalThis.__codeupAuthorizationCache = authorizationCache;

class CodeupAuthorizationError extends Error {
  constructor(message, status = 403) {
    super(message);
    this.name = 'CodeupAuthorizationError';
    this.status = status;
  }
}

function getRequestToken(request) {
  return request.headers.get('x-yunxiao-token')?.trim() || '';
}

function getRequestRepositoryScope(request) {
  const url = new URL(request.url);
  return {
    organizationId: request.headers.get('x-codeup-organization-id')
      || url.searchParams.get('organizationId')
      || '',
    repositoryId: request.headers.get('x-codeup-repository-id')
      || url.searchParams.get('repositoryId')
      || '',
  };
}

function getCacheKey(token, organizationId, repositoryId) {
  // 缓存键只保存 Token 摘要，避免把浏览器 Token 留在服务端全局内存中。
  return crypto
    .createHash('sha256')
    .update(`${token}:${organizationId}:${repositoryId}`)
    .digest('hex');
}

async function verifyRepositoryRead(token, organizationId, repositoryId) {
  const cacheKey = getCacheKey(token, organizationId, repositoryId);
  const cached = authorizationCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return;

  try {
    await getRepository({
      organization_id: organizationId,
      repository_id: repositoryId,
    }, token);
    authorizationCache.set(cacheKey, { expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
  } catch (error) {
    console.warn('[Codeup Auth] 仓库读取权限校验失败', {
      organizationId,
      repositoryId,
      message: error.message,
    });
    throw new CodeupAuthorizationError('当前 Token 无权读取该代码仓库，请检查 Token 权限', 403);
  }
}

async function requireRepositoryRead(request, resource = {}) {
  const token = getRequestToken(request);
  if (!token) {
    throw new CodeupAuthorizationError('请先在浏览器中配置阿里云 Codeup Token', 401);
  }

  const requestScope = getRequestRepositoryScope(request);
  const organizationId = String(
    resource.organization_id || resource.organizationId || requestScope.organizationId || ''
  );
  const repositoryId = String(
    resource.repository_id || resource.repositoryId || requestScope.repositoryId || ''
  );
  if (!organizationId || !repositoryId) {
    throw new CodeupAuthorizationError('缺少代码库鉴权范围，请先选择代码仓库', 400);
  }

  await verifyRepositoryRead(token, organizationId, repositoryId);
  return { token, organizationId, repositoryId };
}

function getAuthorizationError(error) {
  if (!(error instanceof CodeupAuthorizationError)) return null;
  return { status: error.status, message: error.message };
}

module.exports = {
  CodeupAuthorizationError,
  getAuthorizationError,
  getRequestRepositoryScope,
  getRequestToken,
  requireRepositoryRead,
};
