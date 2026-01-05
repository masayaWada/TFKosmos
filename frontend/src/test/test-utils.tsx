/**
 * テストユーティリティ
 *
 * React Testing Library のカスタムレンダラーと便利なヘルパー関数を提供します。
 */

import { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from '../context/AppContext';

/**
 * カスタムレンダラーのオプション
 */
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /**
   * 初期ルート（デフォルト: '/'）
   */
  initialRoute?: string;

  /**
   * AppContextの初期状態（オプション）
   */
  initialState?: any;
}

/**
 * すべてのプロバイダーでラップされたラッパーコンポーネント
 */
function AllTheProviders({
  children,
  initialRoute = '/',
}: {
  children: ReactNode;
  initialRoute?: string;
}) {
  // 初期ルートを設定
  if (initialRoute !== '/') {
    window.history.pushState({}, 'Test page', initialRoute);
  }

  return (
    <BrowserRouter>
      <AppProvider>{children}</AppProvider>
    </BrowserRouter>
  );
}

/**
 * カスタムレンダー関数
 *
 * React Testing Library の render をラップし、
 * 必要なプロバイダーを自動的に適用します。
 *
 * @param ui - レンダリングするReact要素
 * @param options - レンダリングオプション
 * @returns render の戻り値
 *
 * @example
 * ```tsx
 * const { getByText } = renderWithProviders(<MyComponent />);
 * expect(getByText('Hello')).toBeInTheDocument();
 * ```
 *
 * @example
 * ```tsx
 * // 特定のルートでレンダリング
 * const { getByRole } = renderWithProviders(<MyComponent />, {
 *   initialRoute: '/resources',
 * });
 * ```
 */
export function renderWithProviders(
  ui: ReactElement,
  { initialRoute = '/', ...renderOptions }: CustomRenderOptions = {}
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AllTheProviders initialRoute={initialRoute}>{children}</AllTheProviders>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * モックのlocalStorageユーティリティ
 */
export const mockLocalStorage = {
  /**
   * localStorageをクリアする
   */
  clear: () => {
    localStorage.clear();
  },

  /**
   * localStorageに値を設定する
   */
  setItem: (key: string, value: string) => {
    localStorage.setItem(key, value);
  },

  /**
   * localStorageから値を取得する
   */
  getItem: (key: string) => {
    return localStorage.getItem(key);
  },

  /**
   * localStorageから値を削除する
   */
  removeItem: (key: string) => {
    localStorage.removeItem(key);
  },
};

/**
 * 非同期処理を待機するヘルパー
 * 
 * React Testing LibraryのwaitForと名前が衝突しないよう、delayという名前にしています。
 */
export const delay = async (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * 次のTickまで待機
 */
export const nextTick = () => {
  return new Promise((resolve) => setTimeout(resolve, 0));
};

// React Testing Library のすべてのエクスポートを再エクスポート
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
