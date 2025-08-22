import { AutoMergeDB } from '../../../../../lib/database.supabase';
import { NextRequest, NextResponse } from 'next/server';
import { POST as createMergeRequest } from '../../codeup/create-request/route.js';
import { POST as executeMerge } from '../../codeup/merge/route.js';

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

    // 执行合并
    const result = await executeAutoMerge(task);
    
    return NextResponse.json({ 
      success: true, 
      message: '自动合并执行完成',
      data: result
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      message: '执行失败',
      error: error.message
    }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    // 获取执行日志
    const { searchParams } = new URL(request.url);
    const logTaskId = searchParams.get('taskId');
    const limit = searchParams.get('limit');
        
    // 直接查询展示所有日志内容
    const logs = await AutoMergeDB.getAllLogs(parseInt(limit) || 100);
    
    return NextResponse.json({ 
      success: true, 
      data: logs 
    });
  } catch (error) {
    console.error('自动合并执行API错误:', error);
    return NextResponse.json({ 
      success: false, 
      message: '服务器内部错误',
      error: error.message 
    }, { status: 500 });
  }
}

// 执行自动合并的核心函数
export async function executeAutoMerge(task) {
  const startTime = new Date();
  
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
    const token = process.env['CODEUP_TOKEN'] || process.env['NEXT_PUBLIC_TOKEN'];
    const orgId = process.env.CODEUP_ORG_ID;
    
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

    // 第一步：创建合并请求
    const createMergeRequestPayload = {
      token,
      orgId,
      repoId: task.repository_id,
      sourceBranch: task.source_branch,
      targetBranch: task.target_branch,
      title: `[自动合并] ${task.source_branch} -> ${task.target_branch}`,
      description: `由自动合并任务 "${task.name}" 创建\n执行时间: ${startTime.toLocaleString()}`,
    };

    // 调用创建合并请求API
    console.log('🚀 开始创建合并请求，参数:', JSON.stringify(createMergeRequestPayload, null, 2));
    
    // 创建模拟的Request对象（URL仅用于满足构造函数要求，不会发起实际网络请求）
    const createRequest = new Request('internal://api/codeup/create-request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(createMergeRequestPayload)
    });
    
    const createResponse = await createMergeRequest(createRequest);

    console.log('📡 创建合并请求响应状态:', createResponse.status, createResponse.statusText);

    if (!createResponse.ok) {
      const errorData = await createResponse.json();
      console.error('❌ 创建合并请求失败，错误详情:', JSON.stringify(errorData, null, 2));
      throw new Error(`创建合并请求失败: ${errorData.details || errorData.error || '未知错误'}`);
    }

    const mergeRequestData = await createResponse.json();
    console.log('✅ 创建合并请求成功，返回数据:', JSON.stringify(mergeRequestData, null, 2));
    const mergeRequestId = mergeRequestData.localId || mergeRequestData.id;
    console.log('mergeRequestId', mergeRequestId)
    if (!mergeRequestId) {
      throw new Error('创建合并请求成功但未返回有效的请求ID');
    }

    // 记录创建合并请求成功的日志
    await AutoMergeDB.logExecution(
      task.name,
      'success',
      `成功创建合并请求: ${mergeRequestId}`,
      mergeRequestId
    );

    // 第二步：执行合并操作
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

    // 记录完全成功日志
    await AutoMergeDB.logExecution(
      task.name,
      'success',
      `自动合并完全成功，合并请求ID: ${mergeRequestId}`,
      mergeRequestId
    );

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
    
    // 记录失败日志
    await AutoMergeDB.logExecution(
      task.name,
      'failed',
      `自动合并执行失败: ${error.message}`
    );

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