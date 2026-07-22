import { NextResponse } from 'next/server';
import { fetchCodeup } from '../utils.js';

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
        { 
          error: '缺少访问令牌',
          errorDescription: '未提供有效的访问令牌',
          errorMessage: '访问令牌缺失或无效',
          details: '缺少访问令牌'
        },
        { status: 401 }
      );
    }
    
    if (!organizationId || !repositoryId || !localId) {
      return NextResponse.json(
        { 
          error: '缺少必要参数：organizationId, repositoryId, localId',
          errorDescription: '请求参数不完整',
          errorMessage: '缺少必要的组织ID、仓库ID或本地ID参数',
          details: '缺少必要参数：organizationId, repositoryId, localId'
        },
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
    const response = await fetchCodeup(apiUrl, {
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
          details: data.errorDescription || data.errorMessage || '未知错误',
          errorDescription: data.errorDescription,
          errorMessage: data.errorMessage,
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
        errorDescription: '合并请求处理时发生异常',
        errorMessage: error.message,
        details: error.message,
      },
      { status: 500 }
    );
  }
}
