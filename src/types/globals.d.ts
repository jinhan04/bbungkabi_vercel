// types/globals.d.ts

interface KakaoAuthResponse {
  access_token: string;
  token_type: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  refresh_token_expires_in: number;
}

interface Window {
  Kakao: {
    init: (key: string) => void;
    isInitialized: () => boolean;
    Auth: {
      login: (options: {
        scope?: string;
        success: (authObj: KakaoAuthResponse) => void;
        fail: (err: any) => void;
      }) => void;
    };
  };
}
