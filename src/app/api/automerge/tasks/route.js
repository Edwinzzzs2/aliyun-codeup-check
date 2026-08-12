import { AutoMergeDB } from '../../../../../lib/database.supabase';
import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthorizationError,
  getRequestRepositoryScope,
  requireRepositoryRead,
} from '../../../../../lib/codeup.authorization';

function getOrganizationId() {
  return process.env.CODEUP_ORG_ID || '';
}

function findTask(tasks, id) {
  return tasks.find((task) => String(task.id) === String(id));
}

export async function GET(request) {
  try {
    const { repositoryId } = getRequestRepositoryScope(request);
    await requireRepositoryRead(request, {
      organization_id: getOrganizationId(),
      repository_id: repositoryId,
    });
    const tasks = (await AutoMergeDB.getAllTasks())
      .filter((task) => String(task.repository_id) === String(repositoryId));
    return NextResponse.json({ success: true, data: tasks });
  } catch (error) {
    console.error('获取任务列表错误:', error);
    const authorizationError = getAuthorizationError(error);
    return NextResponse.json({
      success: false,
      message: authorizationError?.message || '服务器内部错误',
    }, { status: authorizationError?.status || 500 });
  }
}

export async function POST(request) {
  try {
    // 创建新任务
    const { 
      name, 
      source_branch, 
      target_branch, 
      interval_minutes, 
      enabled = true,
      execute_user,
      repository_id,
      repository_name 
    } = await request.json();
    
    if (!name || !source_branch || !target_branch || !interval_minutes) {
      return NextResponse.json({ 
        success: false, 
        message: '缺少必要参数：name, source_branch, target_branch, interval_minutes' 
      }, { status: 400 });
    }

    if (interval_minutes < 1) {
      return NextResponse.json({ 
        success: false, 
        message: '执行间隔必须大于等于1分钟' 
      }, { status: 400 });
    }

    await requireRepositoryRead(request, {
      organization_id: getOrganizationId(),
      repository_id,
    });

    const taskId = await AutoMergeDB.createTask({
      name,
      source_branch,
      target_branch,
      interval_minutes: parseInt(interval_minutes),
      enabled,
      execute_user,
      repository_id,
      repository_name
    });

    return NextResponse.json({ 
      success: true, 
      message: '自动合并任务创建成功',
      data: { id: taskId }
    }, { status: 201 });
  } catch (error) {
    console.error('创建任务错误:', error);
    const authorizationError = getAuthorizationError(error);
    return NextResponse.json({
      success: false,
      message: authorizationError?.message || '服务器内部错误',
    }, { status: authorizationError?.status || 500 });
  }
}

export async function PUT(request) {
  try {
    // 更新任务
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const updateData = await request.json();
    
    if (!id) {
      return NextResponse.json({ 
        success: false, 
        message: '缺少任务ID' 
      }, { status: 400 });
    }

    const tasks = await AutoMergeDB.getAllTasks();
    const current = findTask(tasks, id);
    if (!current) {
      return NextResponse.json({ success: false, message: '任务不存在' }, { status: 404 });
    }
    await requireRepositoryRead(request, {
      organization_id: getOrganizationId(),
      repository_id: current.repository_id,
    });
    if (updateData.repository_id && String(updateData.repository_id) !== String(current.repository_id)) {
      await requireRepositoryRead(request, {
        organization_id: getOrganizationId(),
        repository_id: updateData.repository_id,
      });
    }

    const updateResult = await AutoMergeDB.updateTask(parseInt(id), updateData);
    
    if (updateResult.changes === 0) {
      return NextResponse.json({ 
        success: false, 
        message: '任务不存在' 
      }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: '任务更新成功' 
    });
  } catch (error) {
    console.error('更新任务错误:', error);
    const authorizationError = getAuthorizationError(error);
    return NextResponse.json({
      success: false,
      message: authorizationError?.message || '服务器内部错误',
    }, { status: authorizationError?.status || 500 });
  }
}

export async function DELETE(request) {
  try {
    // 删除任务
    const { searchParams } = new URL(request.url);
    const deleteId = searchParams.get('id');
    
    if (!deleteId) {
      return NextResponse.json({ 
        success: false, 
        message: '缺少任务ID' 
      }, { status: 400 });
    }

    const tasks = await AutoMergeDB.getAllTasks();
    const current = findTask(tasks, deleteId);
    if (!current) {
      return NextResponse.json({ success: false, message: '任务不存在' }, { status: 404 });
    }
    await requireRepositoryRead(request, {
      organization_id: getOrganizationId(),
      repository_id: current.repository_id,
    });

    const deleteResult = await AutoMergeDB.deleteTask(parseInt(deleteId));
    
    if (deleteResult.changes === 0) {
      return NextResponse.json({ 
        success: false, 
        message: '任务不存在' 
      }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: '任务删除成功' 
    });
  } catch (error) {
    console.error('删除任务错误:', error);
    const authorizationError = getAuthorizationError(error);
    return NextResponse.json({
      success: false,
      message: authorizationError?.message || '服务器内部错误',
    }, { status: authorizationError?.status || 500 });
  }
}
