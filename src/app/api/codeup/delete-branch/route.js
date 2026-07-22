import { validateRequiredParams, makeCodeupApiRequest, extractSearchParams, getRequestToken, fetchCodeup } from '../utils.js';
import { AutoMergeDB } from '../../../../../lib/database.supabase';
import { getProtectedBranchNames } from '../../../../constants/branches.js';

/**
 * 批量请求只要包含保护分支就整批拒绝，避免出现部分分支已删除的意外结果。
 */
function validateDeletableBranches(branchNames) {
  const protectedBranches = getProtectedBranchNames(branchNames);
  if (protectedBranches.length === 0) return null;

  return new Response(JSON.stringify({
    error: `以下保护分支不允许删除：${protectedBranches.join('、')}`,
    protectedBranches,
  }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * 删除单个分支
 */
async function deleteSingleBranch(token, orgId, repositoryId, branchName) {
  console.log(`[删除分支] 开始删除分支: orgId=${orgId}, repositoryId=${repositoryId}, branchName=${branchName}`);
  
  // 对分支名称进行URL编码处理
  const encodedBranchName = encodeURIComponent(branchName);
  console.log(`[删除分支] 编码后的分支名: ${encodedBranchName}`);
  
  // 构建API路径
  const url = `https://openapi-rdc.aliyuncs.com/oapi/v1/codeup/organizations/${orgId}/repositories/${repositoryId}/branches/${encodedBranchName}`;
  console.log(`[删除分支] API路径: ${url}`);
  
  try {
    // 使用统一的API请求函数
    const response = await fetchCodeup(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-yunxiao-token': token
      }
    });
    
    console.log(`[删除分支] API响应状态: ${response.status}`);
    
    if (response.ok) {
      console.log(`[删除分支] 删除成功: ${branchName}`);
      return {
        branchName,
        success: true,
        message: '删除成功'
      };
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.log(`[删除分支] 删除失败:`, errorData);
      return {
        branchName,
        success: false,
        message: errorData.errorMessage || errorData.message || '删除失败'
      };
    }
  } catch (error) {
    console.error(`[删除分支] 删除分支异常:`, error);
    return {
      branchName,
      success: false,
      message: `删除异常: ${error.message}`
    };
  }
}

/**
 * Vercel 会通过转发请求头传递访问者 IP；User-Agent 用于区分共享出口下的不同客户端。
 */
function getRequestClientInfo(request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const ip = forwardedFor?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || '未知 IP';

  return {
    ip,
    userAgent: request.headers.get('user-agent') || '未知客户端',
  };
}

/**
 * 批量删除全部结束后记录一条汇总日志，避免每个分支各写一条造成日志刷屏。
 */
async function logBatchDelete(repositoryId, branchNames, batchResults, clientInfo) {
  const succeeded = batchResults.filter((item) => item.success);
  const failed = batchResults.filter((item) => !item.success);
  const succeededText = succeeded.map((item) => item.branchName).join('、') || '无';
  const failedText = failed
    .map((item) => `${item.branchName}（${item.message}）`)
    .join('、') || '无';

  await AutoMergeDB.logDetailedExecution({
    taskName: `删除分支（仓库 ${repositoryId}）`,
    status: failed.length === 0 ? 'success' : 'failed',
    message: `批量删除分支完成：成功 ${succeeded.length} 个 [${succeededText}]，失败 ${failed.length} 个 [${failedText}]`,
    requestData: {
      repositoryId,
      branchNames,
      clientInfo,
    },
    responseData: {
      total: branchNames.length,
      successCount: succeeded.length,
      failureCount: failed.length,
      results: batchResults,
    },
    errorDetails: failed.length > 0 ? failedText : null,
    executionType: 'branch_delete',
  });
}

/**
 * GET方法 - 删除单个分支
 * Token 通过 x-yunxiao-token 请求头传递。
 * GET /api/codeup/delete-branch?orgId=xxx&repoId=xxx&branchName=xxx
 */
export async function GET(request) {
  // 提取查询参数
  const params = extractSearchParams(request, [
    'token', 'orgId', 'repoId', 'branchName'
  ]);
  
  console.log(`[删除分支API] GET请求参数:`, JSON.stringify({
    orgId: params.orgId,
    repoId: params.repoId,
    branchName: params.branchName,
    hasToken: Boolean(params.token),
  }, null, 2));
  
  // 校验必填参数
  const requiredError = validateRequiredParams(
    params,
    ['token', 'orgId', 'repoId', 'branchName']
  );
  if (requiredError) return requiredError;

  const protectedBranchError = validateDeletableBranches([params.branchName]);
  if (protectedBranchError) return protectedBranchError;
  
  // 删除单个分支
  const result = await deleteSingleBranch(params.token, params.orgId, params.repoId, params.branchName);
  
  if (result.success) {
    return new Response(JSON.stringify({
      result: { message: result.message },
      success: true
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } else {
    return new Response(JSON.stringify({
      error: result.message,
      errorDescription: '删除分支失败',
      errorMessage: result.message,
      details: result.message
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
}

/**
 * POST方法支持单个和批量删除分支
 * POST /api/codeup/delete-branch
 * 
 * 请求体格式:
 * Token 通过 x-yunxiao-token 请求头传递。
 * 单个删除: { "orgId": "xxx", "repoId": "123", "branchName": "feature-branch" }
 * 批量删除: { "orgId": "xxx", "repoId": "123", "branchNames": ["branch1", "branch2", "branch3"] }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { token: bodyToken, orgId, repoId, branchName, branchNames } = body;
    const token = getRequestToken(request, bodyToken);
    console.log(`[删除分支API] 接收到请求:`, JSON.stringify({
      orgId,
      repoId,
      branchName,
      branchNames,
      hasToken: Boolean(token),
    }, null, 2));
    const clientInfo = getRequestClientInfo(request);

    // 验证必需参数
    const requiredError = validateRequiredParams(
      { token, orgId, repoId },
      ['token', 'orgId', 'repoId']
    );
    if (requiredError) return requiredError;

    const requestedBranchNames = branchName
      ? [branchName]
      : Array.isArray(branchNames) ? branchNames : [];
    const protectedBranchError = validateDeletableBranches(requestedBranchNames);
    if (protectedBranchError) return protectedBranchError;

    // 检查是单个删除还是批量删除
    if (branchName) {
      console.log(`[删除分支API] 单个删除模式: ${branchName}`);
      // 单个删除
      const result = await deleteSingleBranch(token, orgId, repoId, branchName);
      
      if (result.success) {
        console.log(`[删除分支API] 单个删除成功`);
        return new Response(JSON.stringify({
          result: { message: result.message },
          success: true
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      } else {
        console.log(`[删除分支API] 单个删除失败: ${result.message}`);
        return new Response(JSON.stringify({
          error: result.message,
          errorDescription: '删除分支失败',
          errorMessage: result.message,
          details: result.message
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
    } else if (branchNames && Array.isArray(branchNames) && branchNames.length > 0) {
      console.log(`[删除分支API] 批量删除模式: ${branchNames.length}个分支`);

      // 并发删除所有分支
      const deletePromises = branchNames.map(async (branch) => {
        try {
          return await deleteSingleBranch(token, orgId, repoId, branch);
        } catch (error) {
          return {
            branchName: branch,
            success: false,
            message: error.message || '删除异常'
          };
        }
      });

      const batchResults = await Promise.all(deletePromises);
      const successCount = batchResults.filter((item) => item.success).length;
      const failureCount = batchResults.length - successCount;

      // 删除结果已经确定，日志写入失败不能反向改变实际的分支删除结果。
      try {
        await logBatchDelete(repoId, branchNames, batchResults, clientInfo);
      } catch (logError) {
        console.error('[删除分支API] 批量删除日志记录失败:', logError);
      }
      
      console.log(`[删除分支API] 批量删除完成: 成功 ${successCount} 个，失败 ${failureCount} 个`);
      
      return new Response(JSON.stringify({
        result: {
          message: `批量删除完成: 成功 ${successCount} 个，失败 ${failureCount} 个`,
          total: branchNames.length,
          successCount,
          failureCount,
          results: batchResults
        },
        success: successCount > 0
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } else {
      console.log(`[删除分支API] 缺少分支名参数`);
      return new Response(JSON.stringify({
        error: '缺少参数 branchName、branchNames'
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

  } catch (error) {
    console.error('[删除分支API] 删除分支异常:', error);
    return new Response(JSON.stringify({
      error: '网络请求失败',
      details: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
