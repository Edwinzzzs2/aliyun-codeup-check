import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Button,
} from '@mui/material';

const ConfirmDialogComponent = ({
  title = '确认',
  message = '',
  confirmText = '确认',
  cancelText = '取消',
  confirmColor = 'primary',
  onConfirm,
  onCancel,
}) => {
  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <Dialog
      open={true}
      onClose={handleCancel}
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
    >
      <DialogTitle id="confirm-dialog-title">
        {title}
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="confirm-dialog-description">
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel}>
          {cancelText}
        </Button>
        <Button 
          onClick={handleConfirm} 
          color={confirmColor}
          autoFocus
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// 创建一个函数式的确认对话框
const confirm = (options = {}) => {
  return new Promise((resolve) => {
    // 创建容器元素
    const container = document.createElement('div');
    document.body.appendChild(container);
    
    // 创建 React root
    const root = createRoot(container);
    
    // 清理函数
    const cleanup = () => {
      root.unmount();
      document.body.removeChild(container);
    };
    
    // 处理确认
    const handleConfirm = () => {
      cleanup();
      if (options.onConfirm) {
        options.onConfirm();
      }
      resolve(true);
    };
    
    // 处理取消
    const handleCancel = () => {
      cleanup();
      if (options.onCancel) {
        options.onCancel();
      }
      resolve(false);
    };
    
    // 渲染对话框
    root.render(
      <ConfirmDialogComponent
        {...options}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    );
  });
};

export default confirm;