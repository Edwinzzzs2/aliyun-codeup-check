import React from 'react';
import { Alert, AlertTitle } from '@mui/material';

const ErrorMessage = ({ error, onClear }) => {
  if (!error) {
    return null;
  }

  const handleClose = () => {
    if (onClear) {
      onClear();
    }
  };

  return (
    <Alert severity="error" onClose={handleClose} sx={{ mt: 2 }}>
      <AlertTitle>操作失败</AlertTitle>
      {error}
    </Alert>
  );
};

export default ErrorMessage;