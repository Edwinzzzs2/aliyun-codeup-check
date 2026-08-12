import { AutoMergeDB } from '../../../../../lib/database.supabase';
import { NextRequest, NextResponse } from 'next/server';
import { POST as createMergeRequest } from '../../codeup/create-request/route.js';
import { POST as executeMerge } from '../../codeup/merge/route.js';
import { POST as compareRequest } from '../../codeup/compare/route.js';
import { GET as getBranchDetail } from '../../codeup/branch-detail/route.js';
import { POST as sendFeishuNotify } from '../../feishu/notify/route.js';
import {
  getAuthorizationError,
  getRequestRepositoryScope,
  requireRepositoryRead,
} from '../../../../../lib/codeup.authorization';

export async function POST(request) {
  try {
    // 手动执行自动合并任务
    const { taskId } = await request.json();
    
    if (!taskId) {
      return NextResponse.json({ 
        success: false, 
        message: '缺少任务ID' 
      }, { status: 400 });
    }

    // 获取任务信息
    const tasks = await AutoMergeDB.getAllTasks();
    const task = tasks.find(t => t.id === parseInt(taskId));
    
    if (!task) {
      return NextResponse.json({ 
        success: false, 
        message: '任务不存在' 
      }, { status: 404 });
    }

    if (!task.enabled) {
      return NextResponse.json({ 
        success: false, 
        message: '任务已禁用' 
      }, { status: 400 });
    }

    const orgId = process.env.CODEUP_ORG_ID;
    const { token } = await requireRepositoryRead(request, {
      organization_id: orgId,
      repository_id: task.repository_id,
    });

    // 网页手动执行使用用户自己的 Token，后台调度才允许使用服务器 Token。
    const result = await executeAutoMerge(task, { token, organizationId: orgId });
    
    return NextResponse.json({ 
      success: true, 
      message: '自动合并执行完成',
      data: result
    });
  } catch (error) {
    console.log('自动合并执行API错误:', error);
    const authorizationError = getAuthorizationError(error);
    return NextResponse.json({ 
      success: false, 
      message: authorizationError?.message || '执行失败',
    }, { status: authorizationError?.status || 500 });
  }
}

export async function GET(request) {
  try {
    const { repositoryId } = getRequestRepositoryScope(request);
    await requireRepositoryRead(request, {
      organization_id: process.env.CODEUP_ORG_ID,
      repository_id: repositoryId,
    });
    const repositoryTasks = (await AutoMergeDB.getAllTasks()).filter((task) => (
      String(task.repository_id) === String(repositoryId)
    ));
    const taskNames = repositoryTasks.map((task) => task.name);
    // 获取执行日志
    const { searchParams } = new URL(request.url);
    const logTaskId = searchParams.get('taskId');
    const page = parseInt(searchParams.get('page')) || 1;
    const pageSize = parseInt(searchParams.get('pageSize')) || 20;
    
    // 计算偏移量
    const offset = (page - 1) * pageSize;
    
    // 获取日志数据和总数
    const [logs, totalCount] = await Promise.all([
      AutoMergeDB.getAllLogs(pageSize, offset, taskNames),
      AutoMergeDB.getLogsCount(taskNames)
    ]);
    
    // 计算分页信息
    const totalPages = Math.ceil(totalCount / pageSize);
    
    return NextResponse.json({ 
      success: true, 
      data: logs,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('自动合并执行API错误:', error);
    const authorizationError = getAuthorizationError(error);
    return NextResponse.json({ 
      success: false, 
      message: authorizationError?.message || '服务器内部错误',
    }, { status: authorizationError?.status || 500 });
  }
}

// 执行自动合并的核心函数
export async function executeAutoMerge(task, options = {}) {
  const startTime = new Date();
  let sourceBranchInfo = null;
  
  try {
    console.log('🎯 开始执行自动合并任务:', task.name);
    console.log('📋 任务详情:', JSON.stringify({
      id: task.id,
      name: task.name,
      source_branch: task.source_branch,
      target_branch: task.target_branch,
      repository_id: task.repository_id,
      repository_name: task.repository_name
    }, null, 2));
    
    // 从环境变量获取必要的配置信息
    const token = options.token || process.env.CODEUP_TOKEN;
    const orgId = options.organizationId || process.env.CODEUP_ORG_ID;
    
    console.log('🔑 环境变量检查:');
    console.log('  - token存在:', !!token, token ? `(长度: ${token.length})` : '');
    console.log('  - orgId:', orgId || '未设置');
    
    if (!token) {
      throw new Error('缺少访问令牌，请检查环境变量 CODEUP_TOKEN');
    }
    
    if (!orgId) {
      throw new Error('缺少组织ID，请检查环境变量 CODEUP_ORG_ID');
    }
    
    if (!task.repository_id) {
      throw new Error('任务缺少仓库ID');
    }

    // 第一步：检查分支是否有变动
    console.log('🔍 开始检查分支变动:', `${task.source_branch} -> ${task.target_branch}`);
    
    try {
      const comparePayload = {
        orgId,
        repoId: task.repository_id,
        from: task.target_branch,
        to: task.source_branch,
        sourceType: 'branch',
        targetType: 'branch'
      };
      
      // 创建模拟的Request对象
      const compareRequestObj = new Request('internal://api/codeup/compare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-yunxiao-token': token
        },
        body: JSON.stringify(comparePayload)
      });
      
      const compareResponse = await compareRequest(compareRequestObj);
      
      if (!compareResponse.ok) {
        console.warn('⚠️ 分支比较检查失败，继续执行合并操作');
      } else {
        const compareData = await compareResponse.json();
        console.log('📊 分支比较结果:', JSON.stringify({
          totalCommits: compareData.commits?.length || 0,
          totalDiffs: compareData.diffs?.length || 0,
          hasChanges: (compareData.commits?.length || 0) > 0 || (compareData.diffs?.length || 0) > 0
        }, null, 2));
        
        // 检查是否有变动
        const hasCommits = compareData.commits && compareData.commits.length > 0;
        const hasDiffs = compareData.diffs && compareData.diffs.length > 0;
        
        if (!hasCommits && !hasDiffs) {
          console.log('ℹ️ 分支间无变动，跳过合并操作');
          
          // 记录无变动的info日志
          await AutoMergeDB.logExecution(
            task.name,
            'info',
            `分支 ${task.source_branch} 与 ${task.target_branch} 之间无变动，跳过合并操作`
          );
          
          // 更新任务的执行时间
          const nextRun = new Date(startTime.getTime() + task.interval_minutes * 60 * 1000);
          await AutoMergeDB.updateTaskRunTime(
            task.id,
            startTime.toISOString(),
            nextRun.toISOString()
          );
          
          const infoResult = {
            status: 'info',
            message: '分支间无变动，跳过合并操作',
            executedAt: startTime,
            nextRun: nextRun
          };
          
          console.log('ℹ️ 自动合并任务完成（无变动）:', JSON.stringify(infoResult, null, 2));
          return infoResult;
        }
        
        console.log('✅ 检测到分支变动，继续执行合并操作');
      }
    } catch (compareError) {
      console.warn('⚠️ 分支比较检查异常，继续执行合并操作:', compareError.message);
    }

    // 第二步：查询源分支信息
    console.log('🔍 开始查询源分支信息:', task.source_branch);
    
    let mergeTitle = `[自动合并] ${task.source_branch} -> ${task.target_branch}`;
    let mergeDescription = `由自动合并任务"${task.name}"创建`;
    
    try {
      // 创建分支详情查询请求
      const branchDetailUrl = `/api/codeup/branch-detail?orgId=${encodeURIComponent(orgId)}&repoId=${encodeURIComponent(task.repository_id)}&branchName=${encodeURIComponent(task.source_branch)}`;
      const branchDetailRequest = new Request(`internal:${branchDetailUrl}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-yunxiao-token': token
        }
      });
      
      const branchDetailResponse = await getBranchDetail(branchDetailRequest);
      
      if (branchDetailResponse.ok) {
        sourceBranchInfo = await branchDetailResponse.json();
        console.log('✅ 源分支信息查询成功:', JSON.stringify(sourceBranchInfo, null, 2));
        
        // 使用commit对象中的message作为合并请求标题（如果存在）
        const commitInfo = sourceBranchInfo.commit || sourceBranchInfo;
        if (commitInfo.title) {
          mergeTitle = commitInfo.title;
        }
        
        // 在描述中添加分支信息
        mergeDescription = `由自动合并任务"${task.name}"创建`;
        if (commitInfo.authorName || (commitInfo.author && commitInfo.author.name)) {
          mergeDescription += `，最近提交人: ${commitInfo.authorName || commitInfo.author.name}`;
        }
      } else {
        console.warn('⚠️ 源分支信息查询失败，使用默认标题和描述');
      }
    } catch (branchError) {
      console.warn('⚠️ 源分支信息查询异常，使用默认标题和描述:', branchError.message);
    }

    // 第三步：创建合并请求
    const createMergeRequestPayload = {
      orgId,
      repoId: task.repository_id,
      sourceBranch: task.source_branch,
      targetBranch: task.target_branch,
      title: mergeTitle,
      description: mergeDescription,
    };

    // 调用创建合并请求API
    console.log('🚀 开始创建合并请求，参数:', JSON.stringify(createMergeRequestPayload, null, 2));
    
    // 创建模拟的Request对象（URL仅用于满足构造函数要求，不会发起实际网络请求）
    const createRequest = new Request('internal://api/codeup/create-request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-yunxiao-token': token
      },
      body: JSON.stringify(createMergeRequestPayload)
    });
    
    const createResponse = await createMergeRequest(createRequest);

    console.log('📡 创建合并请求响应状态:', createResponse.status, createResponse.statusText);

    if (!createResponse.ok) {
      const errorData = await createResponse.json();
      console.error('❌ 创建合并请求失败，错误详情:', JSON.stringify(errorData, null, 2));
      
      // 构建包含提交信息的失败消息
      let failureMessage = `创建合并请求失败: ${errorData.details || errorData.error || '未知错误'}`;
      if (sourceBranchInfo && sourceBranchInfo.commit) {
        const commitInfo = sourceBranchInfo.commit;
        const commitTitle = commitInfo.title || commitInfo.message || '无标题';
        const commitAuthor = commitInfo.authorName || (commitInfo.author && commitInfo.author.name) || '未知作者';
        failureMessage += `。最近提交信息: ${commitTitle}，提交人: ${commitAuthor}`;
      }
      
      // 直接抛出错误，让外层catch统一处理日志记录
      throw new Error(failureMessage);
    }

    const mergeRequestData = await createResponse.json();
    console.log('✅ 创建合并请求成功，返回数据:', JSON.stringify(mergeRequestData, null, 2));
    const mergeRequestId = mergeRequestData.localId || mergeRequestData.id;
    const mergeRequestDetailUrl = mergeRequestData.detailUrl || '';
    console.log('mergeRequestId', mergeRequestId)
    console.log('mergeRequestDetailUrl', mergeRequestDetailUrl)
    if (!mergeRequestId) {
      throw new Error('创建合并请求成功但未返回有效的请求ID');
    }

    // 构建包含提交信息的创建合并请求成功消息
    let createSuccessMessage = `成功创建合并请求: ${mergeRequestId}`;
    if (sourceBranchInfo && sourceBranchInfo.commit) {
      const commitInfo = sourceBranchInfo.commit;
      const commitTitle = commitInfo.title || commitInfo.message || '无标题';
      const commitAuthor = commitInfo.authorName || (commitInfo.author && commitInfo.author.name) || '未知作者';
      createSuccessMessage += `。最近提交信息: ${commitTitle}，提交人: ${commitAuthor}`;
    }
    
    // 记录创建合并请求成功的日志
    await AutoMergeDB.logExecution(
      task.name,
      'success',
      createSuccessMessage,
      mergeRequestId,
      null, // operator
      null, // requestData
      null, // responseData
      null, // errorDetails
      'auto', // executionType
      mergeRequestDetailUrl
    );

    // 第四步：执行合并操作
    const mergePayload = {
      organizationId: orgId,
      repositoryId: task.repository_id,
      localId: mergeRequestId,
      mergeMessage: `自动合并: ${task.source_branch} -> ${task.target_branch}`,
      mergeType: 'no-fast-forward',
      removeSourceBranch: false
    };

    console.log('🔄 开始执行合并操作，参数:', JSON.stringify(mergePayload, null, 2));
    
    // 创建模拟的Request对象（URL仅用于满足构造函数要求，不会发起实际网络请求）
    const mergeRequest = new Request('internal://api/codeup/merge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-yunxiao-token': token
      },
      body: JSON.stringify(mergePayload)
    });
    
    const mergeResponse = await executeMerge(mergeRequest);

    console.log('📡 合并操作响应状态:', mergeResponse.status, mergeResponse.statusText);

    if (!mergeResponse.ok) {
      const errorData = await mergeResponse.json();
      console.error('❌ 合并操作失败，错误详情:', JSON.stringify(errorData, null, 2));
      // 合并失败，但合并请求已创建，记录部分成功
      await AutoMergeDB.logExecution(
        task.name,
        'failed',
        `合并请求创建成功但合并失败: ${errorData.details || errorData.error || '未知错误'}`,
        mergeRequestId
      );
      throw new Error(`合并操作失败: ${errorData.details || errorData.error || '未知错误'}`);
    }

    const mergeResult = await mergeResponse.json();
    console.log('✅ 合并操作成功，返回数据:', JSON.stringify(mergeResult, null, 2));

    // 构建包含提交信息的成功消息
    const successMessage = `${sourceBranchInfo.commit.title}`;
    // 记录完全成功日志
    await AutoMergeDB.logExecution(
      task.name,
      'success',
      successMessage,
      mergeRequestId,
      null, // operator
      null, // requestData
      null, // responseData
      null, // errorDetails
      'auto', // executionType
      mergeRequestDetailUrl
    );

    // 发送飞书成功通知
    try {
      const notifyRequest = new Request('internal://api/feishu/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-yunxiao-token': token,
          'x-codeup-organization-id': orgId,
          'x-codeup-repository-id': String(task.repository_id),
        },
        body: JSON.stringify({
          type: 'auto_merge',
          configId: task.feishu_config_id,
          taskName: task.name,
          status: 'success',
          message: successMessage,
          mergeRequestId: mergeRequestId,
          mergeRequestUrl: mergeRequestDetailUrl,
          repositoryName: task.repository_name,
          sourceBranch: task.source_branch,
          targetBranch: task.target_branch,
          mergeTitle: `自动合并: ${task.source_branch} -> ${task.target_branch}`
        })
      });
      await sendFeishuNotify(notifyRequest);
    } catch (notifyError) {
      console.warn('发送飞书成功通知失败:', notifyError.message);
    }

    // 更新任务的执行时间
    const nextRun = new Date(startTime.getTime() + task.interval_minutes * 60 * 1000);
    await AutoMergeDB.updateTaskRunTime(
      task.id,
      startTime.toISOString(),
      nextRun.toISOString()
    );

    const successResult = {
      status: 'success',
      mergeRequestId: mergeRequestId,
      mergeResult: mergeResult,
      executedAt: startTime,
      nextRun: nextRun
    };
    
    console.log('🎉 自动合并任务完全成功！结果:', JSON.stringify(successResult, null, 2));
    return successResult;

  } catch (error) {
    console.error('💥 自动合并任务执行失败:', error.message);
    console.error('📊 错误堆栈:', error.stack);
    
    // 构建包含提交信息的失败消息
    let failureMessage = `自动合并执行失败: ${error.message}`;

    // 记录失败日志
    await AutoMergeDB.logExecution(
      task.name,
      'failed',
      failureMessage
    );

    // 发送飞书失败通知
    try {
      const notifyRequest = new Request('internal://api/feishu/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-yunxiao-token': token,
          'x-codeup-organization-id': orgId,
          'x-codeup-repository-id': String(task.repository_id),
        },
        body: JSON.stringify({
          type: 'auto_merge',
          configId: task.feishu_config_id,
          taskName: task.name,
          status: 'failed',
          message: failureMessage,
          mergeRequestId: null,
          mergeRequestUrl: null,
          repositoryName: task.repository_name,
          sourceBranch: task.source_branch,
          targetBranch: task.target_branch,
          mergeTitle: `自动合并: ${task.source_branch} -> ${task.target_branch}`
        })
      });
      await sendFeishuNotify(notifyRequest);
      console.log('✅ 通用错误飞书通知发送成功');
    } catch (notifyError) {
      console.warn('发送飞书失败通知失败:', notifyError.message);
    }

    // 禁用失败的任务
    try {
      await AutoMergeDB.updateTask(task.id, {
        enabled: false
      });
      console.log('✅ 任务已自动禁用，避免重复报错');
    } catch (disableError) {
      console.warn('禁用任务失败:', disableError.message);
    }

    // 仍然更新下次执行时间
    const nextRun = new Date(startTime.getTime() + task.interval_minutes * 60 * 1000);
    await AutoMergeDB.updateTaskRunTime(
      task.id,
      startTime.toISOString(),
      nextRun.toISOString()
    );

    const failedResult = {
      status: 'failed',
      error: error.message,
      executedAt: startTime,
      nextRun: nextRun
    };
    
    console.log('❌ 自动合并任务失败结果:', JSON.stringify(failedResult, null, 2));
    return failedResult;
  }
}
