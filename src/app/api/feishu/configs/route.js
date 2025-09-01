import { AutoMergeDB } from '../../../../../lib/database.supabase';
import { NextRequest, NextResponse } from 'next/server';

// 获取所有飞书通知配置
export async function GET(request) {
  try {
    const configs = await AutoMergeDB.getAllFeishuConfigs();
    return NextResponse.json({ 
      success: true, 
      data: configs || []
    });
  } catch (error) {
    console.error('获取飞书配置错误:', error);
    return NextResponse.json({ 
      success: false, 
      message: '服务器内部错误',
      error: error.message 
    }, { status: 500 });
  }
}

// 创建新的飞书通知配置
export async function POST(request) {
  try {
    const body = await request.json();
    
    // 验证必填字段
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({
        success: false,
        message: '配置名称是必填字段'
      }, { status: 400 });
    }

    if (!body.webhook_url || !body.webhook_url.trim()) {
      return NextResponse.json({
        success: false,
        message: 'Webhook URL 是必填字段'
      }, { status: 400 });
    }

    // 验证 Webhook URL 格式
    try {
      new URL(body.webhook_url);
    } catch {
      return NextResponse.json({
        success: false,
        message: 'Webhook URL 格式不正确'
      }, { status: 400 });
    }

    const config = await AutoMergeDB.createFeishuConfig({
      name: body.name.trim(),
      webhook_url: body.webhook_url.trim(),
      enabled: body.enabled ?? true,
      notify_on_success: body.notify_on_success ?? true,
      notify_on_failure: body.notify_on_failure ?? true,
      custom_message_template: body.custom_message_template || null
    });

    return NextResponse.json({ 
      success: true, 
      data: config,
      message: '飞书通知配置创建成功'
    });
  } catch (error) {
    console.error('创建飞书配置错误:', error);
    return NextResponse.json({ 
      success: false, 
      message: '服务器内部错误',
      error: error.message 
    }, { status: 500 });
  }
}