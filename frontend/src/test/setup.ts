import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Monaco Editorのためのブラウザーポリフィル
if (typeof document !== 'undefined') {
  // queryCommandSupported is required by Monaco Editor
  if (!document.queryCommandSupported) {
    document.queryCommandSupported = () => false;
  }
  // execCommand is required by Monaco Editor
  if (!document.execCommand) {
    document.execCommand = () => false;
  }
}

// 各テスト後にクリーンアップ
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

// localStorageのモック
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});
