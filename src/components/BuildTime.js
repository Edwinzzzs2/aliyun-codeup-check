import { Chip, Box } from '@mui/material';

export default function BuildTime() {
  const buildTime = process.env.BUILD_TIME;
  
  if (!buildTime) {
    return null;
  }

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  return (
    <Chip
      label={`最近更新: ${formatTime(buildTime)}`}
      size="small"
      sx={{
        fontSize: '0.7rem',
        height: '24px',
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        color: 'rgba(0, 0, 0, 0.6)',
        '&:hover': {
          backgroundColor: 'rgba(0, 0, 0, 0.08)',
        },
      }}
    />
  );
}