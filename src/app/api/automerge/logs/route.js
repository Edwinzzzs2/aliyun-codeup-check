import { AutoMergeDB } from '../../../../../lib/database';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const logId = searchParams.get('id');
    const limit = searchParams.get('limit') || 100;
    
    if (logId) {
      // 获取单个日志详情
      const logDetail = AutoMergeDB.getLogDetail(parseInt(logId));
      
      if (!logDetail) {
        return NextResponse.json({ 
          success: false, 
          message: '日志不存在' 
        }, { status: 404 });
      }
      
      return NextResponse.json({ 
        success: true, 
        data: logDetail 
      });
    } else {
      // 获取所有日志列表
      const logs = AutoMergeDB.getAllLogs(parseInt(limit));
      return NextResponse.json({ 
        success: true, 
        data: logs 
      });
    }
  } catch (error) {
    console.error('获取日志错误:', error);
    return NextResponse.json({ 
      success: false, 
      message: '服务器内部错误',
      error: error.message 
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    // 创建详细执行日志
    const logData = await request.json();
    
    const {
      taskName,
      status,
      message,
      mergeRequestId,
      operator,
      requestData,
      responseData,
      errorDetails,
      executionType
    } = logData;
    
    if (!taskName || !status || !message) {
      return NextResponse.json({ 
        success: false, 
        message: '缺少必要参数：taskName, status, message' 
      }, { status: 400 });
    }

    const logId = AutoMergeDB.logDetailedExecution({
      taskName,
      status,
      message,
      mergeRequestId,
      operator,
      requestData,
      responseData,
      errorDetails,
      executionType: executionType || 'manual'
    });

    return NextResponse.json({ 
      success: true, 
      message: '日志记录成功',
      data: { id: logId.lastInsertRowid }
    }, { status: 201 });
  } catch (error) {
    console.error('创建日志错误:', error);
    return NextResponse.json({ 
      success: false, 
      message: '服务器内部错误',
      error: error.message 
    }, { status: 500 });
  }
}