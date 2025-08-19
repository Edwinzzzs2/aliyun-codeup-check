import { NextResponse } from 'next/server';

// 合并请求API
export async function POST(request) {
  try {
    const body = await request.json();
    console.log('合并API接收到的请求体:', body);
    
    const { organizationId, repositoryId, localId, mergeMessage = '', mergeType = 'no-fast-forward', removeSourceBranch = false } = body;
    
    // 从请求头获取token
    const token = request.headers.get('x-yunxiao-token');
    
    if (!token) {
      return NextResponse.json(
        { error: '缺少访问令牌' },
        { status: 401 }
      );
    }
    
    if (!organizationId || !repositoryId || !localId) {
      return NextResponse.json(
        { error: '缺少必要参数：organizationId, repositoryId, localId' },
        { status: 400 }
      );
    }
    
    // 构建阿里云CodeUp API URL
    const apiUrl = `https://openapi-rdc.aliyuncs.com/oapi/v1/codeup/organizations/${organizationId}/repositories/${repositoryId}/changeRequests/${localId}/merge`;
    
    // 准备请求体
    const requestBody = {
      mergeMessage,
      mergeType,
      removeSourceBranch
    };
    
    // 调用阿里云CodeUp API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-yunxiao-token': token
      },
      body: JSON.stringify(requestBody)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('CodeUp API错误:', data);
      return NextResponse.json(
        { 
          error: '合并请求失败',
          details: data.message || data.error || '未知错误',
          code: data.code
        },
        { status: response.status }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: '合并请求成功',
      data
    });
    
  } catch (error) {
    console.error('合并请求API错误:', error);
    return NextResponse.json(
      { 
        error: '服务器内部错误',
        details: error.message
      },
      { status: 500 }
    );
  }
}