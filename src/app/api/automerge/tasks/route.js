import { AutoMergeDB } from '../../../../../lib/database';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request) {
  try {
    // 获取所有任务
    const tasks = AutoMergeDB.getAllTasks();
    return NextResponse.json({ success: true, data: tasks });
  } catch (error) {
    console.error('获取任务列表错误:', error);
    return NextResponse.json({ 
      success: false, 
      message: '服务器内部错误',
      error: error.message 
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    // 创建新任务
    const { name, source_branch, target_branch, interval_minutes } = await request.json();
    
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

    const taskId = AutoMergeDB.createTask({
      name,
      source_branch,
      target_branch,
      interval_minutes: parseInt(interval_minutes)
    });

    return NextResponse.json({ 
      success: true, 
      message: '自动合并任务创建成功',
      data: { id: taskId }
    }, { status: 201 });
  } catch (error) {
    console.error('创建任务错误:', error);
    return NextResponse.json({ 
      success: false, 
      message: '服务器内部错误',
      error: error.message 
    }, { status: 500 });
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

    const updateResult = AutoMergeDB.updateTask(parseInt(id), updateData);
    
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
    return NextResponse.json({ 
      success: false, 
      message: '服务器内部错误',
      error: error.message 
    }, { status: 500 });
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

    const deleteResult = AutoMergeDB.deleteTask(parseInt(deleteId));
    
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
    return NextResponse.json({ 
      success: false, 
      message: '服务器内部错误',
      error: error.message 
    }, { status: 500 });
  }
}