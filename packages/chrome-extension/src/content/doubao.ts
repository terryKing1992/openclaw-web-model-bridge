export class DoubaoClient {
  private botId: string = '7338286299411103781';
  
  constructor() {
    console.log('[OpenClaw] DoubaoClient 初始化');
  }
  
  async checkLogin(): Promise<boolean> {
    try {
      const response = await fetch('https://www.doubao.com/api/user/info', {
        credentials: 'include',
      });
      return response.ok;
    } catch {
      return false;
    }
  }
  
  getBotId(): string {
    return this.botId;
  }
}