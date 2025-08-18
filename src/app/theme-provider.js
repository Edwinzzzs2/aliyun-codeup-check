'use client';

import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// 全局主题：统一色板、圆角、阴影与组件风格，营造更清晰一致的视觉层次
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1976d2' },
    secondary: { main: '#6c63ff' },
    background: {
      default: '#f5f7fb',
      paper: '#ffffff',
    },
    divider: 'rgba(0,0,0,0.08)',
    text: {
      primary: '#1f2937',
      secondary: '#6b7280',
    },
  },
  shape: {
    // borderRadius: 10,
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h6: { fontWeight: 700 },
    subtitle2: { fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: { height: '100%' },
        body: {
          height: '100%',
        },
        // 自定义滚动条
        '*::-webkit-scrollbar': {
          width: 10,
          height: 10,
        },
        '*::-webkit-scrollbar-thumb': {
          backgroundColor: 'rgba(0,0,0,0.15)',
          // borderRadius: 8,
          border: '2px solid transparent',
          backgroundClip: 'content-box',
        },
        '*::-webkit-scrollbar-thumb:hover': {
          backgroundColor: 'rgba(0,0,0,0.25)',
        },
      },
    },
    MuiAppBar: {
      defaultProps: { color: 'default' },
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          minHeight: '56px',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#f7f9fc',
          borderRight: '1px solid rgba(0,0,0,0.08)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          // borderRadius: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          // borderRadius: 10,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        // root: { borderRadius: 10 },
        notchedOutline: { borderColor: 'rgba(0,0,0,0.12)' },
      },
    },
    // DataGrid 全局美化
    MuiDataGrid: {
      styleOverrides: {
        root: {
          border: 'none',
        },
        columnHeaders: {
          backgroundColor: '#f0f4ff',
          borderBottom: '1px solid rgba(0,0,0,0.06) !important',
        },
        row: {
          '&:hover': {
            backgroundColor: 'rgba(25, 118, 210, 0.04)',
          },
        },
        selectedRowCount: {
          color: '#6b7280',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          // borderRadius: 8,
          margin: '2px 8px',
        },
      },
    },
  },
});

export function ThemeProvider({ children }) {
  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}