declare module "node-quickbooks" {
  class QuickBooks {
    constructor(
      clientId: string,
      clientSecret: string,
      accessToken: string,
      tokenSecret: boolean,
      realmId: string,
      useSandbox: boolean,
      debug: boolean,
      minorVersion: string | null,
      oauthVersion: string,
      refreshToken: string
    );
    findVendors(criteria: Record<string, unknown>, callback: (err: Error | null, data: unknown) => void): void;
    findBills(criteria: Record<string, unknown>, callback: (err: Error | null, data: unknown) => void): void;
    createBill(bill: Record<string, unknown>, callback: (err: Error | null, data: unknown) => void): void;
    createPurchase(purchase: Record<string, unknown>, callback: (err: Error | null, data: unknown) => void): void;
  }
  export = QuickBooks;
}

declare module "intuit-oauth" {
  class OAuthClient {
    static scopes: { Accounting: string; Payment: string };
    constructor(config: {
      clientId: string;
      clientSecret: string;
      environment: string;
      redirectUri: string;
    });
    authorizeUri(params: { scope: string[]; state: string }): string;
    createToken(url: string): Promise<{ getJson(): Record<string, string> }>;
  }
  export = OAuthClient;
}
