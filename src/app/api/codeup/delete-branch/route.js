import { validateRequiredParams, makeCodeupApiRequest, extractSearchParams } from '../utils.js';

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
    const response = await fetch(url, {
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
 * GET方法 - 删除单个分支
 * GET /api/codeup/delete-branch?token=xxx&orgId=xxx&repoId=xxx&branchName=xxx
 */
export async function GET(request) {
  // 提取查询参数
  const params = extractSearchParams(request, [
    'token', 'orgId', 'repoId', 'branchName'
  ]);
  
  console.log(`[删除分支API] GET请求参数:`, JSON.stringify(params, null, 2));
  
  // 校验必填参数
  const requiredError = validateRequiredParams(
    params,
    ['token', 'orgId', 'repoId', 'branchName']
  );
  if (requiredError) return requiredError;
  
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
 * 单个删除: { "token": "xxx", "orgId": "xxx", "repoId": "123", "branchName": "feature-branch" }
 * 批量删除: { "token": "xxx", "orgId": "xxx", "repoId": "123", "branchNames": ["branch1", "branch2", "branch3"] }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    console.log(`[删除分支API] 接收到请求:`, JSON.stringify(body, null, 2));
    
    const { token, orgId, repoId, branchName, branchNames } = body;

    // 验证必需参数
    const requiredError = validateRequiredParams(
      { token, orgId, repoId },
      ['token', 'orgId', 'repoId']
    );
    if (requiredError) return requiredError;

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
      // 批量删除
      const results = [];
      let successCount = 0;
      let failureCount = 0;

      // 并发删除所有分支
      const deletePromises = branchNames.map(async (branch) => {
        try {
          const result = await deleteSingleBranch(token, orgId, repoId, branch);
          if (result.success) {
            successCount++;
          } else {
            failureCount++;
          }
          return result;
        } catch (error) {
          failureCount++;
          return {
            branchName: branch,
            success: false,
            message: error.message || '删除异常'
          };
        }
      });

      const batchResults = await Promise.all(deletePromises);
      
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