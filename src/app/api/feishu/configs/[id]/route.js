import { AutoMergeDB } from '../../../../../../lib/database.supabase';
import { NextRequest, NextResponse } from 'next/server';

// 获取特定飞书通知配置
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json({
        success: false,
        message: '配置ID是必需的'
      }, { status: 400 });
    }

    const config = await AutoMergeDB.getFeishuConfigById(id);
    
    if (!config) {
      return NextResponse.json({
        success: false,
        message: '配置不存在'
      }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      data: config
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

// 更新特定飞书通知配置
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    if (!id) {
      return NextResponse.json({
        success: false,
        message: '配置ID是必需的'
      }, { status: 400 });
    }

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

    const config = await AutoMergeDB.updateFeishuConfig(id, {
      name: body.name.trim(),
      webhook_url: body.webhook_url.trim(),
      enabled: body.enabled ?? true,
      notify_on_success: body.notify_on_success ?? true,
      notify_on_failure: body.notify_on_failure ?? true,
      custom_message_template: body.custom_message_template || null
    });

    if (!config) {
      return NextResponse.json({
        success: false,
        message: '配置不存在或更新失败'
      }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      data: config,
      message: '飞书通知配置更新成功'
    });
  } catch (error) {
    console.error('更新飞书配置错误:', error);
    return NextResponse.json({ 
      success: false, 
      message: '服务器内部错误',
      error: error.message 
    }, { status: 500 });
  }
}

// 删除特定飞书通知配置
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json({
        success: false,
        message: '配置ID是必需的'
      }, { status: 400 });
    }

    const result = await AutoMergeDB.deleteFeishuConfig(id);
    
    if (!result) {
      return NextResponse.json({
        success: false,
        message: '配置不存在或删除失败'
      }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: '飞书通知配置删除成功'
    });
  } catch (error) {
    console.error('删除飞书配置错误:', error);
    return NextResponse.json({ 
      success: false, 
      message: '服务器内部错误',
      error: error.message 
    }, { status: 500 });
  }
}